import { InputHints } from 'botbuilder';
import { ComponentDialog, DialogContext, DialogTurnResult, DialogTurnStatus } from 'botbuilder-dialogs';
import { UsefulConst } from '../utilities/Utilities';

/**
 * This base class watches for common phrases like "help" and "cancel" and takes action on them
 * BEFORE they reach the normal bot logic.
 */
export class CancelAndHelpDialog extends ComponentDialog {
    constructor(id: string) {
        super(id);
    }

    public async onContinueDialog(innerDc: DialogContext): Promise<DialogTurnResult> {
        const result = await this.interrupt(innerDc);
        if (result) {
            return result;
        }
        return await super.onContinueDialog(innerDc);
    }

    private async interrupt(innerDc: DialogContext): Promise<DialogTurnResult | undefined> {
        if (innerDc.context.activity.text) {
            const text = innerDc.context.activity.text.toLowerCase();
            if (text == UsefulConst.HOME.toLowerCase()) {
                await innerDc.context.sendActivity('Okay, ricominciamo', InputHints.IgnoringInput);
                return await innerDc.cancelAllDialogs();
            }
        }
    }
}