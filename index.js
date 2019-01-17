'use strict'
const login = require("facebook-chat-api");
const request = require('request');
const fs = require('file-system');
const jq = require('node-jq');
const express = require('express');

const app = express();
app.set('port', (process.env.PORT || 5000));

var stopsUrl = 'https://ckan.multimediagdansk.pl/dataset/c24aa637-3619-4dc2-a171-a23eec8f2172/resource/4c4025f0-01bf-41f7-a39f-d156d201b82b/download/stops.json';
var estimatedUrl = 'http://87.98.237.99:88/delays?stopId=';
var helpText = "To get the following buses' arriving hours, just enter the name of the bus stop. !!!IMPORTANT!!! 1.This bot only works for Gdańsk Poland. 2.You have to start each word with a capital letter.";
 
// Create simple echo bot
login({email: "xyz", password: "xyz"}, (err, api) => {
    if(err) return console.error(err);

function findStopId(stopName)
{
    return new Promise(function(resolve, reject){
    var filter = '[.[].stops[] | select(.stopDesc | test("'+stopName+'")) | .stopId]';
    jq.run(filter, 'data.json', { output: 'json' })
    .then((output) => {

        let id = new Array;

        output.forEach(element => {
            if(!id.includes(element))
            {
                id.push(element);
            }
        });
        id.splice(11, id.length-12);
        //callback
        resolve(id);

    })
    .catch((err) => {
        console.error(err);
        reject(err);
    });
    })
    
}

function findStopName(stopName)
{
    return new Promise(function(resolve, reject){
    var filter = '[.[].stops[] | select(.stopDesc | test("'+stopName+'")) | .stopDesc + " " + .stopCode]';
    jq.run(filter, 'data.json', { output: 'json' })
    .then((output) => {
        let names = new Array;

        output.forEach(element => {
            if(!names.includes(element))
            {
                names.push(element);
            }
        });
        names.splice(11, names.length-12);
        //callback
        resolve(names);
    })
    .catch((err) => {
        console.error(err);
        reject(err);
    })
    })
    
}

function findStopEstimated()
{
    return new Promise(function(resolve, reject){
        var filter = '[.[].delay[] | .routeId, .headsign, .estimatedTime]';
        jq.run(filter, 'stop.json', { slurp: true, output: 'json' })
        .then((output) => {
                let finalData = new Array;
                output.forEach(element => {
                finalData.push(element);
            });
            //console.log(finalData);
            resolve(finalData);
        })
        .catch((err) => {
            console.error(err);
            reject(err);
        })
    })
        
}

function download(url, path)
{
    return new Promise(function(resolve, reject){
        request
        .get(url)
        .on('error', function(err) {
        console.log(err)
        reject(err);
        })
        .on('response', function(response){
            console.log(response.statusCode);
            resolve("Ok");
        }) 
        .pipe(fs.createWriteStream(path));
    })  
}

function sendText(text, sender)
{
    return new Promise(function(resolve, reject){
        api.sendMessage(text, sender, function(err, messageInfo){
            resolve(messageInfo);
        });
    })
}

async function sendResponse(txt, who){
    try{
        let data = new Array;
        let names = new Array;
        let est = new Array;
        data = await findStopId(txt);
        console.log(data);
        names = await findStopName(txt);
        console.log(names);
        for(var j=0; j<data.length; ++j)
        {
            await download(estimatedUrl+data[j], 'stop.json');
            await sendText(names[j], who);
            est = await findStopEstimated();
            if(est.length == 0)
            {
                await sendText("No buses aviable right now. Or there is an error with ZTM api", who);
            }
            else{
            for(var k=0; k<est.length; k=k+3)
            {
                await sendText(est[k]+" "+est[k+1]+" "+est[k+2], who);
            }
            }
        }

    }catch(error){
        console.log(error);
    }
}
 
api.listen((err, message) => {
        //api.sendMessage(message.body, message.threadID);

        let text = message.body;
        if(text == "Help" || text == "help")
        {
            api.sendMessage(helpText, message.threadID);
        }
        else
        {
            sendResponse(text, message.threadID);  
        }
    });
});

app.get('/', function(req, res){
    res.send("Hello world");
});


setInterval(function(){

    request
    .get('https://projektmarcinekv2.herokuapp.com/')
    .on('response', function(response){
        console.log(response.statusCode);
    });

}, 300000);

app.listen(app.get('port'), function(){
    console.log("running: port "+app.get('port'));
});