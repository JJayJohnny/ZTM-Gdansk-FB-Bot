'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const fs = require('file-system');
const jq = require('node-jq');

const app = express();

app.set('port', (process.env.PORT || 5000));

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

let token = "xyz";

var stopsUrl = 'https://ckan.multimediagdansk.pl/dataset/c24aa637-3619-4dc2-a171-a23eec8f2172/resource/4c4025f0-01bf-41f7-a39f-d156d201b82b/download/stops.json';
var estimatedUrl = 'http://87.98.237.99:88/delays?stopId=';
var helpText = "To get the following buses' arriving hours, just enter the name of the bus stop. !!!IMPORTANT!!! 1.This bot only works for Gdańsk Poland. 2.You have to start each word with a capital letter.";
var errorText = 'No buses aviable right now. Try again later'

//routes

app.get('/', function(req, res){
    res.send("Hello world");
});
        
app.get('/webhook/', function(req, res){
    if(req.query['hub.verify_token']=="marcinek")
    {
        res.send(req.query['hub.challenge']);
    }
    else res.send("wrong token");
});
        
app.post('/webhook/', function(req, res){
    let messagingEvents = req.body.entry[0].messaging;
    for(let i=0; i< messagingEvents.length; i++)
    {
        let event = messagingEvents[i];
        let sender = event.sender.id;
        if(event.message && event.message.text)
        {
            let text = event.message.text;
            //sendText(sender, "Text echo: " + text);

            if(text == "Help" || text == "help")
            {
                sendText(sender, helpText);
            }
            else
            {
                sendResponse(text, sender);  
            }  
        }
    }
    res.sendStatus(200);
});

function sendText(sender, text)
{
    return new Promise(function(resolve, reject){
        let messageData = {text: text};
        request({
        url: "https://graph.facebook.com/v2.9/me/messages",
        qs: {access_token: token},
        method: "POST",
        json:{
            recipient: {id: sender},
            message: messageData
        }
    }, function(error, response, body){
        if(error){
            console.log("error");
            reject(error);
        }else if(response.body.error){
            console.log("response body error");
            reject(error);
        }
        resolve("Ok");
    }
    );
    })
}


        

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
            await sendText(who, names[j]);
            est = await findStopEstimated();
            if(est.length == 0)
            {
                await sendText(who, errorText);
            }
            else{
            for(var k=0; k<est.length; k=k+3)
            {
                await sendText(who, est[k]+" "+est[k+1]+" "+est[k+2]);
            }
            }
        }

    }catch(error){
        console.log(error);
    }
}

setInterval(function(){

    request
    .get('https://projektmarcinek.herokuapp.com/')
    .on('response', function(response){
        console.log(response.statusCode);
    });

}, 300000);

app.listen(app.get('port'), function(){
    console.log("running: port "+app.get('port'));
});

