import { MyPlace } from "./myPlace";

export class UserProfile {
    public userID: string;
    public placesList: Array<MyPlace>;

    constructor(userID?:string){
        this.userID = userID;
        this.placesList = new Array<MyPlace>();
    }

}
