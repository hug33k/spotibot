import Credentials from "./src/credentials.json" assert { type: "json" };
import { SpotifyApi } from "@spotify/web-api-ts-sdk";

const sdk = SpotifyApi.withUserAuthorization(Credentials.clientID, "http://localhost:3333", Credentials.scopes);

sdk.authenticate();

console.log(sdk);

const response = await sdk.search("Depeche Mode Enjoy The Silence", ["track"]);

console.log(response.tracks.items[0]);

console.log("End");
