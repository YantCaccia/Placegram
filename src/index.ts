import { config } from 'dotenv';
import * as path from 'path';
import * as restify from 'restify';

// App Config
const appConfig = require("@azure/app-configuration");
const connection_string = process.env.AZURE_APP_CONFIG_CONNECTION_STRING;
const appConfigClient = new appConfig.AppConfigurationClient(connection_string);

import {
    CloudAdapter,
    ConfigurationBotFrameworkAuthentication,
    ConfigurationBotFrameworkAuthenticationOptions,
    ConversationState,
    MemoryStorage,
    UserState
} from 'botbuilder';

// This bot's main dialog.
import { DialogBot } from './bots/dialogBot';
import { UserProfileDialog } from './dialogs/userProfileDialog';
import { Utilities } from './utilities/Utilities';
import { AzureKeyCredential, TextAnalyticsClient } from '@azure/ai-text-analytics';

const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(process.env as ConfigurationBotFrameworkAuthenticationOptions);

const adapter = new CloudAdapter(botFrameworkAuthentication);

// A bot requires a state storage system to persist the dialog and user state between messages.
const memoryStorage = new MemoryStorage();
// Create conversation state with in-memory storage provider.
const conversationState = new ConversationState(memoryStorage);

// Catch-all for errors.
adapter.onTurnError = async (context, error) => {
    // This check writes out errors to console log .vs. app insights.
    // NOTE: In production environment, you should consider logging this to Azure
    //       application insights.
    console.error(`\n [onTurnError] unhandled error: ${error}`);

    // Send a trace activity, which will be displayed in Bot Framework Emulator
    await context.sendTraceActivity(
        'OnTurnError Trace',
        `${error}`,
        'https://www.botframework.com/schemas/error',
        'TurnError'
    );

    // Send a message to the user
    await context.sendActivity('Il bot ha riscontrato un errore. Riprova!');
    // Clear out state
    await conversationState.delete(context);
};

// Lesgo
async function main(): Promise<void> {

    // All keys from Azure App Config
    const cosmosDbEndpoint = await appConfigClient.getConfigurationSetting({
        key: "cosmosdb-endpoint"
    });
    const cosmosDbAuthKey = await appConfigClient.getConfigurationSetting({
        key: "cosmosdb-authkey"
    });
    const cosmosDbDatabaseId = await appConfigClient.getConfigurationSetting({
        key: "cosmosdb-databaseid"
    });
    const cosmosDbContainerId = await appConfigClient.getConfigurationSetting({
        key: "cosmosdb-containerid"
    });
    const azureMapsSubKey = await appConfigClient.getConfigurationSetting({
        key: "maps_sub_key"
    });
    const azureLanguageEndpoint = await appConfigClient.getConfigurationSetting({
        key: "language-endpoint"
    })
    const azureLanguageKey = await appConfigClient.getConfigurationSetting({
        key: "language-key"
    })
    appConfigClient.getConfigurationSetting({key: "googlemaps-key"}).then(key => {
        Utilities.googleMapsApiKey = key.value;
    });


    //Database config
    // const ENV_FILE = path.join(__dirname, '..', '.env');
    // require('dotenv').config({ path: ENV_FILE });
    const { CosmosDbPartitionedStorage } = require('botbuilder-azure');
    const dbStorage = new CosmosDbPartitionedStorage({
        // cosmosDbEndpoint: process.env.CosmosDbEndpoint,
        cosmosDbEndpoint: cosmosDbEndpoint.value,
        // authKey: process.env.CosmosDbAuthKey,
        authKey: cosmosDbAuthKey.value,
        // databaseId: process.env.CosmosDbDatabaseId,
        databaseId: cosmosDbDatabaseId.value,
        // containerId: process.env.CosmosDbContainerId,
        containerId: cosmosDbContainerId.value,
        compatibilityMode: false
    });

    // Language service
    const textAnalyticsClient = new TextAnalyticsClient(azureLanguageEndpoint.value,  new AzureKeyCredential(azureLanguageKey.value));

    // Create user state with db storage provider.
    const userState = new UserState(dbStorage);

    // Create the main dialog.
    const dialog = new UserProfileDialog(userState, new AzureKeyCredential(azureMapsSubKey.value), textAnalyticsClient);
    const bot = new DialogBot(conversationState, userState, dialog);

    // Create HTTP server.
    const server = restify.createServer();
    server.use(restify.plugins.bodyParser());

    server.listen(process.env.port || process.env.PORT || 3978, () => {
        console.log(`\n${server.name} listening to ${server.url}.`);
    });

    // Listen for incoming requests.
    server.post('/api/messages', async (req, res) => {
        // Route received a request to adapter for processing
        await adapter.process(req, res, (context) => bot.run(context));
    });
}

main();

