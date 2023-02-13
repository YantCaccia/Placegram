import { StatePropertyAccessor, UserState } from 'botbuilder';
import {
    ChoiceFactory,
    ChoicePrompt,
    ComponentDialog,
    ListStyle,
    WaterfallDialog,
    WaterfallStepContext
} from 'botbuilder-dialogs';
import { MyPlace } from '../myPlace';
import { UserProfile } from '../userProfile';
import { UsefulConst, Utilities } from '../utilities/Utilities';
import { CancelAndHelpDialog } from './manageHome';

const PLACE_NAME_PROMPT = 'PLACE_NAME_TOREMOVE_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';

export class RemovePlace extends CancelAndHelpDialog {

    private userProfile: StatePropertyAccessor<UserProfile>;

    constructor(dialogId: string, userProfile: StatePropertyAccessor<UserProfile>) {
        super(dialogId);

        this.userProfile = userProfile;

        this.addDialog(new ChoicePrompt(PLACE_NAME_PROMPT));

        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.placeStep.bind(this),
            this.finalStep.bind(this)
        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    private async placeStep(stepContext: WaterfallStepContext) {
        const user: UserProfile = (await this.userProfile.get(stepContext.context, new UserProfile()));
        const placesInList: Array<MyPlace> = user.placesList;
        if (placesInList.length > 0) {
            return await stepContext.prompt(PLACE_NAME_PROMPT, {
                choices: ChoiceFactory.toChoices(Utilities.addGoHomeToChoicePrompt(placesInList.map(v => `${v.name}, ${v.municipality}`))),
                prompt: 'Quale posto vuoi rimuovere dalla tua lista?',
                style: ListStyle.suggestedAction

            });
        } else {
            await stepContext.context.sendActivity('Non hai luoghi nella tua lista!');
            return await stepContext.endDialog();
        }
    }

    private async finalStep(stepContext: WaterfallStepContext) {
        const userProfile = await this.userProfile.get(stepContext.context, new UserProfile());
        // Get choice details
        const [placeName, placeMunicipality] = Utilities.getNameAndMunicipalityFromChoice(stepContext.result.value);
        // Delete place from user's list
        userProfile.placesList = userProfile.placesList.filter(p => Utilities.isNotXatNotY(p, placeName, placeMunicipality));
        // Finish
        await stepContext.context.sendActivity(`Ok, ${placeName} rimosso dalla tua lista!`);
        return await stepContext.endDialog();
    }

}
