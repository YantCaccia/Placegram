// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ActivityHandler, BotState, ConversationState, StatePropertyAccessor, UserState } from 'botbuilder';
import { Dialog, DialogState } from 'botbuilder-dialogs';
import { UserProfileDialog } from '../dialogs/userProfileDialog';
export class DialogBot extends ActivityHandler {
    private conversationState: BotState;
    private userState: BotState;
    private dialog: Dialog;
    private dialogState: StatePropertyAccessor<DialogState>;
    /**
     *
     * @param {ConversationState} conversationState
     * @param {UserState} userState
     * @param {Dialog} dialog
     */
    constructor(conversationState: BotState, userState: BotState, dialog: Dialog) {
        super();
        if (!conversationState) throw new Error('[DialogBot]: Missing parameter. conversationState is required');
        if (!userState) throw new Error('[DialogBot]: Missing parameter. userState is required');
        if (!dialog) throw new Error('[DialogBot]: Missing parameter. dialog is required');

        this.conversationState = conversationState as ConversationState;
        this.userState = userState as UserState;
        this.dialog = dialog;
        this.dialogState = this.conversationState.createProperty('DialogState');

        // Sends welcome messages to conversation members when they join the conversation.
        // Messages are only sent to conversation members who aren't the bot.
        this.onMembersAdded(async (context, next) => {
            // Iterate over all new members added to the conversation
            for (const idx in context.activity.membersAdded) {
                if (context.activity.membersAdded[idx].id !== context.activity.recipient.id) {
                    await context.sendActivity('Benvenuto in Placegram!');
                }
            }

            // Run the Dialog with the new message Activity.
            await (this.dialog as UserProfileDialog).run(context, this.dialogState);

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onMessage(async (context, next) => {
            console.log('Running dialog with Message Activity.');

            // Run the Dialog with the new message Activity.
            await (this.dialog as UserProfileDialog).run(context, this.dialogState);

            await next();
        });

        this.onDialog(async (context, next) => {
            // Save any state changes. The load happened during the execution of the Dialog.
            await this.conversationState.saveChanges(context, false);
            await this.userState.saveChanges(context, false);
            await next();
        });

    }
}
