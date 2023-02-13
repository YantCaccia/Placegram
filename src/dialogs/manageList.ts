import { ActionTypes, ActivityTypes, CardAction, MessageFactory, StatePropertyAccessor } from 'botbuilder';
import {
    ChoiceFactory,
    ChoicePrompt,
    ListStyle,
    NumberPrompt,
    TextPrompt,
    WaterfallDialog,
    WaterfallStepContext
} from 'botbuilder-dialogs';
import { MyPlace } from '../myPlace';
import { UserProfile } from '../userProfile';
import { UsefulConst, Utilities } from '../utilities/Utilities';
import { CancelAndHelpDialog } from './manageHome';

export enum Place_Interaction_Actions {
    RATE = 'Valuta',
    TOGGLE_VISITED = 'Contrassegna come visitato / non visitato',
    MODIFY_TAGS = 'Modifica la lista dei tag associati',
    GET_REVIEWS = 'Leggi recensioni'
}

const PLACES_LIST = 'PLACES_LIST';
const PLACE_INTERACTION = 'PLACE_INTERACTION';
const PLACE_RATE = 'PLACE_RATE';
const PLACE_MODIFYTAGS = 'PLACE_MODIFYTAGS';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';

export class ManageList extends CancelAndHelpDialog {

    private userProfile: StatePropertyAccessor<UserProfile>;

    constructor(dialogId: string, userProfile: StatePropertyAccessor<UserProfile>) {
        super(dialogId);

        this.userProfile = userProfile;

        this.addDialog(new TextPrompt(PLACES_LIST));
        this.addDialog(new ChoicePrompt(PLACE_INTERACTION));
        this.addDialog(new NumberPrompt(PLACE_RATE, Utilities.rateValidator));
        this.addDialog(new TextPrompt(PLACE_MODIFYTAGS));

        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.firstStep.bind(this),
            this.promptListStep.bind(this),
            this.branchStep.bind(this),
            this.showSelectedPlaceStep.bind(this),
            this.placeInteractionStep.bind(this),
            this.modifyPropertyAndEndStep.bind(this),
            this.returnToShowSelecedPlaceStep.bind(this)
        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    private async firstStep(stepContext: WaterfallStepContext) {
        // Welcome to this dialog
        await stepContext.context.sendActivity('Ecco la tua lista:');
        // Get the user
        const userProfile = await this.userProfile.get(stepContext.context, new UserProfile());
        // His list
        const placesList: Array<MyPlace> = userProfile.placesList;
        (stepContext.values as any).placesList = placesList;

        return await stepContext.next();
    }

    private async promptListStep(stepContext: WaterfallStepContext) {
        const suggActions = Utilities.addGoHomeToTextPrompt(
            ((stepContext.values as any).placesList as Array<MyPlace>).map(v => new Object({
                type: ActionTypes.PostBack,
                title: `${v.name}, ${v.municipality}`,
                value: `${v.name}, ${v.municipality}`,

            })));
        const toPrompt = MessageFactory.suggestedActions(suggActions as CardAction[], 'Seleziona un luogo per ulteriori azioni o scrivi uno o più tag per filtrare la tua lista');
        return await stepContext.prompt(PLACES_LIST, toPrompt);
    }

    private async branchStep(stepContext: WaterfallStepContext) {
        // User searched for some tags
        if (stepContext.result && stepContext.result.startsWith('#')) {
            // Get all tags
            const tags: Array<string> = Utilities.getTags(stepContext.result);
            // If a place contains all tags searched by user add it to newList
            const newList = ((await this.userProfile.get(stepContext.context)).placesList as Array<MyPlace>).filter(p => tags.every(t => p.tags.includes(t))); //  oh yes motherfkcers - oneliners joy
            // Save newList
            (stepContext.values as any).placesList = newList;
            // Go back to the state of placeStep
            stepContext.activeDialog.state["stepIndex"] = stepContext.activeDialog.state["stepIndex"] - 1;
            // Go back to placeStep
            return await this.promptListStep(stepContext);
        } else { // User wants some place details
            // Get choice details
            const [placeName, placeMunicipality] = Utilities.getNameAndMunicipalityFromChoice(stepContext.result);
            // Save them
            ((stepContext.values as any).selectedPlace as MyPlace) = (stepContext.values as any).placesList.filter(p => Utilities.isXatY(p, placeName, placeMunicipality))[0];
            return await stepContext.next();
        }
    }

    private async showSelectedPlaceStep(stepContext: WaterfallStepContext) {
        // Get updates if any..
        // Save old selectedPlace
        const oldSelectedPlace: MyPlace = (stepContext.values as any).selectedPlace;
        // Get the user
        const userProfile = await this.userProfile.get(stepContext.context, new UserProfile());
        // His list
        const placesList: Array<MyPlace> = userProfile.placesList;
        // Update selectedPlace
        (stepContext.values as any).selectedPlace = placesList.filter(p => Utilities.isXatY(p, oldSelectedPlace.name, oldSelectedPlace.municipality))[0];
        // Now show the place
        await stepContext.context.sendActivity({
            type: ActivityTypes.Message,
            attachments: [await Utilities.createHeroCard((stepContext.values as any).selectedPlace)]
        })
        return await stepContext.prompt(PLACE_INTERACTION, {
            choices: ChoiceFactory.toChoices(Utilities.addGoHomeToChoicePrompt(Object.values(Place_Interaction_Actions))),
            prompt: `Cosa vuoi fare con ${(stepContext.values as any).selectedPlace.name}?`,
            style: ListStyle.suggestedAction
        });
    }

    private async placeInteractionStep(stepContext: WaterfallStepContext) {
        switch (stepContext.result.value) {
            case Place_Interaction_Actions.RATE:
                return await this.placeInteractionRate(stepContext);
            case Place_Interaction_Actions.MODIFY_TAGS:
                return await this.placeInteractionModifyTags(stepContext);
            case Place_Interaction_Actions.TOGGLE_VISITED:
                return await this.placeInteractionToggleVisited(stepContext);
            case Place_Interaction_Actions.GET_REVIEWS:
                return await this.placeInteractionGetReviews(stepContext);
            default:
                return await stepContext.endDialog();
        }
    }

    private async modifyPropertyAndEndStep(stepContext: WaterfallStepContext) {
        // Get the user
        const userProfile = await this.userProfile.get(stepContext.context, new UserProfile());
        // His list
        const placesList: Array<MyPlace> = userProfile.placesList;
        // Message to show
        let msg;
        // Modify selected property
        switch ((stepContext.values as any).latestStep) {
            case Place_Interaction_Actions.RATE:
                placesList.map(v => v.name == (stepContext.values as any).selectedPlace.name ? v.rate = stepContext.result : null);
                msg = 'Ok, la valutazione è stata aggiornata!'
                break;
            case Place_Interaction_Actions.MODIFY_TAGS:
                let tags = stepContext.result != UsefulConst.ELIMINA ? Utilities.getTags(stepContext.result) : []
                placesList.map(v => v.name == (stepContext.values as any).selectedPlace.name ? v.tags = tags : null);
                msg = 'Ok, la lista tag è stata aggiornata!'
                break;
            default:
                return await stepContext.next();
        }

        await stepContext.context.sendActivity(msg);
        return await stepContext.next();
    }

    private async returnToShowSelecedPlaceStep(stepContext: WaterfallStepContext) {
        stepContext.activeDialog.state["stepIndex"] = 3;
        return await this.showSelectedPlaceStep(stepContext);
    }

    private async placeInteractionRate(stepContext: WaterfallStepContext) {
        (stepContext.values as any).latestStep = Place_Interaction_Actions.RATE;
        const toPrompt = MessageFactory.suggestedActions(Utilities.addGoHomeToChoicePrompt([]), 'Valuta questo posto con un voto da 1 a 100..')
        return await stepContext.prompt(PLACE_RATE, toPrompt);
    }

    private async placeInteractionModifyTags(stepContext: WaterfallStepContext) {
        (stepContext.values as any).latestStep = Place_Interaction_Actions.MODIFY_TAGS;
        return await stepContext.prompt(PLACE_MODIFYTAGS, {
            prompt: MessageFactory.suggestedActions(Utilities.addGoHomeToTextPrompt([{
                type: ActionTypes.PostBack,
                title: `${UsefulConst.ELIMINA}`,
                value: `${UsefulConst.ELIMINA}`,
            }]), 'Scrivi i nuovi #tag oppure eliminali tutti..')
        });
    }

    private async placeInteractionToggleVisited(stepContext: WaterfallStepContext) {
        (stepContext.values as any).latestStep = Place_Interaction_Actions.TOGGLE_VISITED;
        // Useful var
        let msg = '';
        // Get the user
        const userProfile = await this.userProfile.get(stepContext.context, new UserProfile());
        // His list
        const placesList: Array<MyPlace> = userProfile.placesList;
        // Toggle selected place
        for (const v of placesList.values()) {
            if (v.name == (stepContext.values as any).selectedPlace.name) {
                if (v.visited) {
                    v.visited = false;
                    msg = `Ok, ${v.name} è stato contrassegnato come non visitato`;
                } else {
                    v.visited = true;
                    msg = `Ok, ${v.name} è stato contrassegnato come visitato`;
                }
                // short circuit
                break;
            }
        }
        await stepContext.context.sendActivity(msg);
        return await stepContext.next();
    }

    private async placeInteractionGetReviews(stepContext: WaterfallStepContext) {
        (stepContext.values as any).latestStep = Place_Interaction_Actions.GET_REVIEWS;
        const reviews: Array<string> = await Utilities.getPlaceReviews((stepContext.values as any).selectedPlace);
        for (let review of reviews) {
            await stepContext.context.sendActivity(review);
        }
        return await stepContext.next();
    }

}