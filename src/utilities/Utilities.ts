import { Client, FindPlaceFromTextRequest, FindPlaceFromTextResponse, PlaceDetailsRequest, PlaceDetailsResponse, PlaceInputType, PlacePhoto } from "@googlemaps/google-maps-services-js";
import { placePhoto } from "@googlemaps/google-maps-services-js/dist/places/photo";
import { ActionTypes, CardFactory, CardAction } from "botbuilder";
import { PromptValidatorContext, WaterfallStepContext } from "botbuilder-dialogs";
import { Place_Interaction_Actions } from "../dialogs/manageList";
import { MyPlace } from "../myPlace";

export enum UsefulConst {
    ELIMINA = 'Elimina tutti i tag',
    HOME = 'Ricomincia'
}

export class Utilities {

    public static googleMapsApiKey: string;

    public static stringifyMyPlace(place: MyPlace) {
        return (
            `\n📍 Indirizzo: ${place.address}
        \n🏠 Città: ${place.municipality}`
            + (place.phone != undefined ? `
        \n📞 Telefono: ${place.phone}` : '')
            + (place.url != undefined ? `
        \n🖥️ Sito web: ${place.url}` : '')
            + `
        \n✅ Già visitato: ${place.visited ? 'Si' : 'No'}`
            + (place.rate > 0 ? `
        \n💯 La tua valutazione: ${place.rate}` : '')
            + (place.tags.length > 0 ? `
        \n#️⃣ I tuoi tag: ${place.tags.join(' ')}` : '')
        )
    }

    public static isXatY(place: MyPlace, x: string, y: string): boolean {
        return place.name == x && place.municipality == y;
    }

    public static isNotXatNotY(place: MyPlace, x: string, y: string): boolean {
        return place.name != x && place.municipality != y;
    }

    public static getNameAndMunicipalityFromChoice(choice: string) {
        const value: string[] = choice.split(',');
        const placeName: string = value[0].trim();
        const placeMunicipality: string = value[1] ? value[1].trim() : '';
        return [placeName, placeMunicipality];
    }

    public static getTags(tagString: string): string[] {
        return tagString.trim().split(' ');
    }

    public static async createHeroCard(place: MyPlace) {
        return CardFactory.heroCard(
            place.name,
            Utilities.stringifyMyPlace(place),
            CardFactory.images([await this.getPlaceImage(`${place.name} ${place.address}`)])
        );
    }

    public static async rateValidator(promptContext: PromptValidatorContext<number>) {
        return promptContext.recognized.succeeded && promptContext.recognized.value > 0 && promptContext.recognized.value <= 100;
    }

    private static async getPlaceImage(inputQuery: string): Promise<string> {
        const textParams = {
            input: inputQuery,
            inputtype: PlaceInputType.textQuery,
            key: this.googleMapsApiKey,
            fields: ["place_id", "photo"],
        };
        const client = new Client({});
        const result = await client.findPlaceFromText({ params: textParams } as FindPlaceFromTextRequest);
        const photo_reference = result.data.candidates[0].photos[0].photo_reference;
        return new Promise((resolve) => {
            resolve(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=` + `${photo_reference}` + '&key=' + `${this.googleMapsApiKey}`);
        })
    }

    public static async getPlaceReviews(place: MyPlace): Promise<string[]> {
        const textParams = {
            input: `${place.name} ${place.municipality}`,
            inputtype: PlaceInputType.textQuery,
            key: this.googleMapsApiKey,
            fields: ["place_id"],
        };
        const client = new Client({});
        const placeId = (await client.findPlaceFromText({ params: textParams } as FindPlaceFromTextRequest)).data.candidates[0].place_id;
        const placeDetails: PlaceDetailsResponse = await client.placeDetails({params: {key: this.googleMapsApiKey, place_id: placeId, fields: ['reviews'], language: 'it'}} as PlaceDetailsRequest);
        const reviews = placeDetails.data.result.reviews;
        let toBeRet: Array<string> = [];
        reviews.forEach(r => {
            toBeRet.push(`
            \nDa: ${r.author_name}
            \nValutazione: ${this.fromIntToStart(r.rating)}
            \nRecensione: 
            \n\n${r.text}
            `)
        });
        return new Promise(resolve => {
            resolve(toBeRet);
        })
    }

    public static addGoHomeToChoicePrompt(choiches: Array<any>) {
        return choiches.concat([`${UsefulConst.HOME}`]);
    }

    public static addGoHomeToTextPrompt(choiches: Array<any>) {
        return choiches.concat(new Object({
            type: ActionTypes.PostBack,
            title: `${UsefulConst.HOME}`,
            value: `${UsefulConst.HOME}`,

        }));
    }

    private static fromIntToStart(int: number){
        return new Array(int).fill('⭐️').join('');
    }

}