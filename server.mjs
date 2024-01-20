import Credentials from "./src/credentials.json" assert { type: "json" };
import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import express from "express";
import expressWs from "express-ws";

let verify = {};
let tokens = {};

const generateSpotifyAuthUrl = async () => {

	const generateVerifier = (size) => {
		let value = "";
		const dictionnary = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		for (let idx = 0; idx < size; idx++) {
			value += dictionnary.charAt(Math.floor(Math.random() * dictionnary.length));
		}
		return value;
	};

	const generateChallenge = async (verifier) => {
		const data = new TextEncoder().encode(verifier);
		const digest = await crypto.subtle.digest("SHA-256", data);
		return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
			.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
	};

	const verifier = generateVerifier(64);
	const challenge = await generateChallenge(verifier);
	verify = { verifier, challenge };

	const params = new URLSearchParams();
	params.append("client_id", Credentials.clientID);
	params.append("response_type", "code");
	params.append("redirect_uri", "http://localhost:3333/auth");
	params.append("scope", Credentials.scopes.join(" "));
	params.append("code_challenge_method", "S256");
	params.append("code_challenge", challenge);

	return "https://accounts.spotify.com/authorize?" + params.toString();
};

const getAccessToken = async (code) => {
	const params = new URLSearchParams();
	params.append("client_id", Credentials.clientID);
	params.append("grant_type", "authorization_code");
	params.append("code", code);
	params.append("redirect_uri", "http://localhost:3333/auth");
	params.append("code_verifier", verify.verifier);

	const request = await fetch("https://accounts.spotify.com/api/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: params
	});

	tokens = await request.json();
	return tokens;
};

const getCurrentSong = async () => {
	const sdk = SpotifyApi.withAccessToken(Credentials.clientID, tokens);
	return await sdk.player.getCurrentlyPlayingTrack();
};

const addSong = async (input) => {
	const sdk = SpotifyApi.withAccessToken(Credentials.clientID, tokens);

	const formatShort = /^https:\/\/spotify(?:.app)?.link\//;
	const formatLong = /^https:\/\/open.spotify.com\/[\w-\/]*track\//;
	const formatUri = /^spotify:track:/;

	let uri = null;

	if (input.match(formatShort)) {
		const request = await fetch(input, {
			method: "GET"
		});
		const body = await request.text();
		const regexTarget = /<a class=\"secondary-action\" href=\"https:\/\/open.spotify.com\/track\/([\w\d]+)/;
		uri = body.match(regexTarget)[1];
	} else if (input.match(formatLong)) {
		uri = "spotify:track:" + input.split("/track/")[1].split("?")[0];
	} else if (input.match(formatUri)) {
		uri = input;
	} else {
		const searchResult = await sdk.search(input, ["track"]);
		uri = searchResult.tracks[0].uri;
	}

	if (!uri) {
		return "Error";
	}

	const response = await sdk.player.addItemToPlaybackQueue(uri);
	return response;
};

const app = express();
const appWs = expressWs(app);

app.get('/auth', async (req, res) => {
	console.log(await getAccessToken(req.query.code));
	res.send("OK");
});

app.get('/now', async (req, res) => {
	const now = await getCurrentSong();
	res.send(now);
});

app.get('/add', async (req, res) => {
	const result = await addSong(req.query.search);
	res.send(result);
});

app.ws('/', (ws, req) => {
	ws.on('message', async (msg) => {
		switch (msg.replace("\n", "")) {
			case "now":
				ws.send(JSON.stringify(await getCurrentSong()));
				break;
			case "add":
				ws.send("add");
				break;
			default:
				ws.send("error");
		}
	});
	console.log(req);
})

app.listen(3333, async () => {

	console.log("Start");

	const api = SpotifyApi.withClientCredentials(
		Credentials.clientID,
		Credentials.clientSecret
	);
	
	const response = await api.search("Depeche Mode Enjoy The Silence", ["track"]);
	
	console.log(response.tracks.items[0]);
	
	console.log("End");

	console.log(await generateSpotifyAuthUrl());
});

