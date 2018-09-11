var request = require("request");
var parser = require('episode-parser');
var qbtApi = require('qbittorrent-api');
var fs = require('fs');
var login = require('facebook-chat-api');
var commandLineArgs = require('command-line-args');

let config = JSON.parse(fs.readFileSync("./config.json"));
let fbapi = null;
let harshil_id = config.facebook.myID;

const optionsDefs = [
    { name: "id", alias: "i", type: String },
    { name: "season", alias: "s", type: String },
    { name: "episode", alias: "e", type: String } ,
]
const options = commandLineArgs(optionsDefs);

let stack = [];

let execute = () => {
    if (!fbapi)
        return;
    while (stack.length > 0) {
        let msg = stack.pop();
        console.log("Sending ", msg);
        fbapi.sendMessage(msg, harshil_id);
    }
};

let sendMessage = (msg) => { stack.push(msg); execute(); }; 
//login({email: config.facebook.username, password: config.facebook.password}, {pageID: config.facebook.alfredID}, (err, api) => {
//    fbapi = api;
//    execute();
//});

let qbt = qbtApi.connect(config.qbittorent.host, config.qbittorent.username, config.qbittorent.password);
let list = config.shows;


show_episode = options["episode"];
show_season = parseInt(options["season"]);
id = options["id"];
name = "";

for (let i=0; i<list.length; i++) {
    if (list[i][0] == id) name = list[i][1];
}

to_down = function(episode, season) {
    if (show_episode == "all") {
        return show_season == season;
    } else {
        return show_season == season & parseInt(show_episode) == episode;
    }
};

cache = {};

let url = 'https://eztv.ag/api/get-torrents?imdb_id=' + id + "&page=";
var d_list = [];

console.log(url);

let download_tor = function (torrents) {
    torrents.forEach(torrent => {
        let result = parser(torrent.filename);
        let episode = result.episode;
        let season = result.season;
        let url = torrent.magnet_url;
        let ep_id = episode + '-' + season;


        if (to_down(episode, season) & !cache[ep_id]) {
            let folder_name = "~/Media/Series/"+name+"/"+season+"/";

            qbt.add(url, folder_name, ep_id, (error) => {
                 qbt.downloading(ep_id, {}, (error, items) => {
                     qbt.toggleSeqDl(items);
                });
            });

            console.log("downloading");

            cache[ep_id] = 1;
            d_list.push(ep_id);
            sendMessage("Downloading " + name + " (" + season + "," + episode + ")");
        }
    });
};

let request_pages = function (page) {
    console.log(page, url+page);
    request(url + page, (error, response, body) => {
        let torrents = null;
        try {
            torrents = JSON.parse(response.body).torrents;
        } catch (error) {
            console.log("error");
            console.log(error);
            return;
        }

        if (torrents == null)
            return;
        
        download_tor(torrents);
        request_pages(page+1);
    });
};


request_pages(1);

