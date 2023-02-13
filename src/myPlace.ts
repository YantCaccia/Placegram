export class MyPlace {

    public name: string;
    public phone: string;
    public url: string;
    public address: string;
    public municipality: string;
    public visited: boolean;
    public rate: number;
    public tags: Array<string>;

    constructor(name?: string, phone?: string, url?: string, address?: string, municipality?: string) {

        this.name = name;
        this.phone = phone;
        this.url = url;
        this.address = address;
        this.municipality = municipality;
        this.visited = false;
        this.rate = 0;
        this.tags = [];

    }

}