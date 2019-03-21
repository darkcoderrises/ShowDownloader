var request = require("request");
var parser = require('episode-parser');
var qbtApi = require('qbittorrent-api');
var fs = require('fs');
var login = require('facebook-chat-api');
var FuzzySearch = require('fuzzy-search');
var commandLineArgs = require('command-line-args');

let config = JSON.parse(fs.readFileSync("./config.json"));

const optionsDefs = [
    { name: "id", alias: "i", type: String },
    { name: "season", alias: "s", type: String },
    { name: "episode", alias: "e", type: String } ,
    { name: "fuzzy", alias: 'f', type: String},
]
const options = commandLineArgs(optionsDefs);

let stack = [];

let qbt = qbtApi.connect(config.qbittorent.host, config.qbittorent.username, config.qbittorent.password);
let list = config.shows;

show_episode = options["episode"];
show_season = parseInt(options["season"]);
id = options["id"];

if (options['fuzzy']) {
    const search = new FuzzySearch(list.map(function (i) { return {name: i[1], id: i[0]}}), ['name']);
    const result = search.search(options['fuzzy'])[0];
    id = result.id;
    name = result.name;
} else {
    name = "";

    for (let i=0; i<list.length; i++) {
        if (list[i][0] == id) name = list[i][1];
    }
}

console.log(name);

to_down = function(episode, season) {
    if (show_episode == "all") {
        return show_season == season;
    } else {
        return show_season == season & show_episode.split(',').map(i => parseInt(i)).includes(episode);
    }
};

cache = {};

let url = 'https://eztv-ag.unblocksites.club/api/get-torrents?limit=100&imdb_id=' + id + "&page=";

let execute_download = function (cache) {
    Object.keys(cache).forEach(ep_id => {
        let episodes = cache[ep_id];
        let result = episodes.filter(episode => (200 <= episode.size && episode.size <= 500));
        episodes.sort((a,b) => (a.size - b.size));
        let e = result.length == 0 ? episodes[0] : result[0];

        qbt.add(e.url, e.folder_name, ep_id, (error) => {
             qbt.downloading(ep_id, {}, (error, items) => {
                 qbt.toggleSeqDl(items);
            });
            console.log("downloading");
        });
    });
}

let download_tor = function (torrents) {
    torrents.forEach(torrent => {
        let result = parser(torrent.filename);
        if (result == null) return;
        let episode = result.episode;
        let season = result.season;
        let url = torrent.magnet_url;
        let size = torrent.size_bytes / 1000000;
        let ep_id = season + '-' + episode;


        if (to_down(episode, season)) {
            let folder_name = "/home/harshil/Media/Series/"+name+"/"+season+"/";
            if (!cache[ep_id]) cache[ep_id] = [];
            cache[ep_id].push({name, season, url, folder_name, size, episode});

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
            execute_download(cache);
            console.log("error");
            console.log(error);
            return;
        }

        if (torrents == null) {
            execute_download(cache);
            return;
        }
        
        download_tor(torrents);
        request_pages(page+1);
    });
};


request_pages(1);

