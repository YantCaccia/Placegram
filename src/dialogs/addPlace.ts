import { ActivityTypes, MessageFactory, StatePropertyAccessor } from 'botbuilder';
import {
    ChoiceFactory,
    ChoicePrompt,
    ListStyle,
    TextPrompt,
    WaterfallDialog,
    WaterfallStepContext
} from 'botbuilder-dialogs';
import { MyPlace } from '../myPlace';
import { UserProfile } from '../userProfile';

const PLACE_NAME_PROMPT = 'PLACE_NAME_PROMPT';
const CHOOSE_PLACE_PROMPT = 'CHOOSE_PLACE_PROMPT';
const ADD_PLACE_TO_LIST_PROMPT = 'ADD_PLACE_TO_LIST_PROMPT';
const ASK_FOR_TAG_PROMPT = 'ASK_FOR_TAG_PROMPT';
const TAG_PROMPT = 'TAG_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';

// Azure Map Service config
import * as path from 'path';
import { Utilities } from '../utilities/Utilities';
import { AzureKeyCredential, MapsSearchClient } from '@azure/maps-search';
import { CancelAndHelpDialog } from './manageHome';
import { TextAnalyticsClient } from '@azure/ai-text-analytics';
const ENV_FILE = path.join(__dirname, '..', '..', '.env');
require('dotenv').config({ path: ENV_FILE });

export class AddPlace extends CancelAndHelpDialog {

    private userProfile: StatePropertyAccessor<UserProfile>;

    private azureMapsClient: MapsSearchClient;
    private textAnalyticsClient: TextAnalyticsClient;

    constructor(dialogId: string, userProfile: StatePropertyAccessor<UserProfile>, azureMapsKeyCredential: AzureKeyCredential,
        textAnalyticsClient: TextAnalyticsClient) {
        super(dialogId);

        this.azureMapsClient = new MapsSearchClient(azureMapsKeyCredential);
        this.textAnalyticsClient = textAnalyticsClient;

        this.userProfile = userProfile;

        this.addDialog(new TextPrompt(PLACE_NAME_PROMPT));
        this.addDialog(new ChoicePrompt(CHOOSE_PLACE_PROMPT));
        this.addDialog(new ChoicePrompt(ADD_PLACE_TO_LIST_PROMPT));
        this.addDialog(new ChoicePrompt(ASK_FOR_TAG_PROMPT));
        this.addDialog(new TextPrompt(TAG_PROMPT));

        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.placeStep.bind(this),
            this.choosePlaceStep.bind(this),
            this.placeDetailsStep.bind(this),
            this.confirmPlaceStep.bind(this),
            this.askForTagStep.bind(this),
            this.tagStep.bind(this),
            this.finalStep.bind(this)
        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    private async placeStep(stepContext: WaterfallStepContext) {
        const toPrompt = MessageFactory.suggestedActions(Utilities.addGoHomeToTextPrompt([]), 'Cerca il nome di un posto da aggiungere alla tua lista');
        return await stepContext.prompt(PLACE_NAME_PROMPT, toPrompt);
    }

    private async choosePlaceStep(stepContext: WaterfallStepContext) {

        const toSearch: Array<any> = await this.getTextAnalyticsResults(stepContext.result);

        const placeType = toSearch[0];
        const placeLocationCoordinates = toSearch.length > 1 ? toSearch[1] : [40.680556, 14.759722] // Salerno;

        // Setup the fuzzy search query 
        const mapServiceResponse = await this.azureMapsClient.fuzzySearch({
            query: placeType,
            coordinates: placeLocationCoordinates,
            countryCodeFilter: ["IT"],
        });

        (stepContext.values as any).placesList = [];

        mapServiceResponse.results.forEach((result) => {
            try {
                let tmpPOI = result.pointOfInterest;
                let tmpPlace: MyPlace = new MyPlace(tmpPOI.name, tmpPOI.phone, tmpPOI.url, result.address.freeformAddress, result.address.municipality);
                (stepContext.values as any).placesList.push(tmpPlace);
            } catch (error) {
                console.log(error);
            }
        });

        return await stepContext.prompt(CHOOSE_PLACE_PROMPT, {
            choices: ChoiceFactory.toChoices(Utilities.addGoHomeToChoicePrompt((stepContext.values as any).placesList.map(v => `${v.name}, ${v.municipality}`))),
            prompt: 'Ecco i risultati della ricerca. Seleziona un posto per maggiori informazioni.',
            style: ListStyle.suggestedAction
        });

    }

    private async placeDetailsStep(stepContext: WaterfallStepContext) {
        // Get choice details
        const [placeName, placeMunicipality] = Utilities.getNameAndMunicipalityFromChoice(stepContext.result.value);
        // Find place
        (stepContext.values as any).placeToAdd = (stepContext.values as any).placesList.filter(p => Utilities.isXatY(p, placeName, placeMunicipality))[0];
        await stepContext.context.sendActivity({
            type: ActivityTypes.Message,
            attachments: [await Utilities.createHeroCard((stepContext.values as any).placeToAdd)]
        });
        // Ask if he wants this place added to his list
        return await stepContext.prompt(ADD_PLACE_TO_LIST_PROMPT, {
            prompt: 'Vuoi aggiungere questo posto alla tua lista?',
            choices: Utilities.addGoHomeToChoicePrompt(['Si', 'No'])
        });

    }

    private async confirmPlaceStep(stepContext: WaterfallStepContext) {
        if (stepContext.result.value == 'Si') {
            return await stepContext.next();
        } else {
            // Empty place list
            (stepContext.values as any).placesList = [];
            // Go back to the state of placeStep
            stepContext.activeDialog.state["stepIndex"] = stepContext.activeDialog.state["stepIndex"] - 3; // Dunno why is not 2
            // Go back to placeStep
            return await this.placeStep(stepContext);
        }
    }

    private async askForTagStep(stepContext: WaterfallStepContext) {
        return await stepContext.prompt(ASK_FOR_TAG_PROMPT, {
            choices: Utilities.addGoHomeToChoicePrompt(["Si", "No"]),
            prompt: "Vuoi aggiungere dei tag a questo luogo?"
        });
    }

    private async tagStep(stepContext: WaterfallStepContext) {
        if (stepContext.result.value == 'Si') {
            const toPrompt = MessageFactory.suggestedActions(Utilities.addGoHomeToChoicePrompt([]), 'Scrivi i #tag da aggiungere a questo luogo');
            return await stepContext.prompt(TAG_PROMPT, toPrompt)
        } else {
            return await stepContext.next('');
        }

    }

    private async finalStep(stepContext: WaterfallStepContext) {
        // Add tags if they exist
        if (stepContext.result && stepContext.result != '') {
            this.addTags(stepContext, stepContext.result)
        }
        // Add place to user's list
        const userProfile = await this.userProfile.get(stepContext.context, new UserProfile());
        userProfile.placesList.push((stepContext.values as any).placeToAdd as MyPlace);
        // Empty this class' list for future usages
        (stepContext.values as any).placesList = [];
        // Finish
        await stepContext.context.sendActivity(`Ok, ${(stepContext.values as any).placeToAdd.name} aggiunto alla tua lista!`);
        return await stepContext.endDialog();
    }

    private addTags(stepContext: WaterfallStepContext, tagString: string) {
        const tags = Utilities.getTags(tagString);
        tags.forEach(tag => {
            if (tag.startsWith('#')) {
                (stepContext.values as any).placeToAdd.tags.push(tag);
            }
        })
    }

    private async getTextAnalyticsResults(inputString: string) {
        const entityResults = await this.textAnalyticsClient.recognizeEntities([inputString]);
        const placeType = (entityResults[0] as any).entities.filter(v => ['Product', 'Location'].includes(v.category) && (!v.subCategory))[0]?.text;
        const placeLocation = (entityResults[0] as any).entities.filter(v => (v.category == 'Location') && (v.subCategory == 'GPE'))[0]?.text;

        const placeLocationCoordinates = placeLocation ? await this.getCityCoordinates(placeLocation) : '';

        return (placeType && placeLocation) ? [placeType, placeLocationCoordinates] : [inputString];
    }

    private async getCityCoordinates(city: string) {
        const results = await this.azureMapsClient.searchAddress(city);
        return results.results[0].position;
    }



}