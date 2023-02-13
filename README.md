# 📍 Placegram

## What it is 🤖
Placegram is a Telegram bot through which the user can manage his personal list of favorite "places", to be intended as Points of Interest (POIs - Restaurants, Bars, Attractions, etc.). Through Placegram he can search for POIs and save them to retrieve more information later. It is possible to retrieve the basic information of a POI (name, address, city, phone number and website), a presentation photo and the latest reviews of other visitors. You can also tag POIs in your list (to search by #tag later), assign your own rating to the POI, and mark it as visited or not visited.

## Services used  🖥️
### Architecture
![Placegram Diagram for Github](https://user-images.githubusercontent.com/11892754/216854230-d0ae3cf7-a1f9-43d1-bcd4-4d3a945a6253.png)

### How they contribute to Placegram
Azure Bot was used to develop the bot logic, while the code is hosted on Azure App. Each user's list of favorite places is stored on Azure Cosmos DB. The parsing of a POI search query is performed through a Named Entity Recognition system made possible by Azure Cognitive Service for Language, which tries to distinguish the proper name/type of the POI from the place where it is located (e.g., "pizzeria in Napoli" -> pizzeria: type, Napoli: place). Azure Maps is used to geocode the place (find its coordinates) and search for the POI near the coordinates. The photo of the POI and its reviews are instead retrieved from Google Maps Platform. All configuration keys to access the various services are saved and retrieved at runtime through the use of Azure App Configuration. Meanwhile, the key to access Azure App Configuration is saved directly to Azure App, which allows it to be accessed as an environment variable.

## How to provision the Azure resources used  ❓ 
### Resource Group
First things first.. a Resource Group!
```
az group create -l northeurope -n Placegram
```
### Azure App Service
It is mandatory to use the
<a href="https://github.com/microsoft/botbuilder-js/blob/main/generators/generator-botbuilder/generators/app/templates/echo/deploymentTemplates/deployUseExistResourceGroup/template-BotApp-with-rg.json">template file</a>
and the
<a href ="https://github.com/microsoft/botbuilder-js/blob/main/generators/generator-botbuilder/generators/app/templates/echo/deploymentTemplates/deployUseExistResourceGroup/parameters-for-template-BotApp-with-rg.json">parameters template file</a> provided by Azure.
Fill the parameters template file with real values.
```
az deployment group create --resource-group Placegram --template-file <template-file-path> --parameters "@<parameters-file-path>"
```
### Azure Bot
It is mandatory to use the
<a href="https://github.com/microsoft/botbuilder-js/blob/main/generators/generator-botbuilder/generators/app/templates/echo/deploymentTemplates/deployUseExistResourceGroup/template-BotApp-with-rg.json">template file</a>
and the
<a href ="https://github.com/microsoft/botbuilder-js/blob/main/generators/generator-botbuilder/generators/app/templates/echo/deploymentTemplates/deployUseExistResourceGroup/parameters-for-template-AzureBot-with-rg.json">parameters template file</a> provided by Azure.
Fill the parameters template file with real values.
```
az deployment group create --resource-group Placegram --template-file <template-file-path> --parameters "@<parameters-file-path>"
```

### Azure Cognitive Service for Language
Among the various services offered by the Cognitive Services, here the Language service is used. It is recognized by the Azure CLI as *TextAnalytics*.
```
az cognitiveservices account create --name placegram-language --resource-group Placegram --kind TextAnalytics --sku F0 --location northeurope --yes
```

### Azure Cosmos DB
First it is mandatory to create an Azure Cosmos Account
```
az cosmosdb create -n placegram-db -g $Placegram --default-consistency-level Session --locations regionName='North Europe' failoverPriority=0 isZoneRedundant=False
```
Then it's possible to create a Database
```
az cosmosdb database create -n placegram-db -g Placegram -d placegram-db
```

### Azure Maps
```
az maps account create --account-name "placegram-db" --resource-group "Placegram" --sku "S0"
```


### Azure App Config
This service let us store all access keys to other services. We can retrieve them at runtime using the provided client library.
```
az appconfig create -g Placegram -n placegram-appconfig -l northeurope
```

## How can I use it 💬
~~<a href="https://t.me/placegram_bot">Here</a> you go!~~ Free deployment plan, probably won't work
