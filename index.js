const express = require('express')
const exphbs = require("express-handlebars")
const buildUrl = require('build-url');
const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');
const session = require('express-session');
var FileStore = require('session-file-store')(session);
require('dotenv').config()
const app = express()
app.set('view engine', 'hbs');
app.engine('hbs', exphbs({
    defaultLayout: 'main',
    extname: '.hbs'
    }));
const port =  process.env.PORT || 3000
const client = {
    client_id: process.env.Client_id,
    client_secret: process.env.Client_secret,
    redirect_uri: "http://localhost:3000/callback"
}
const authProvider = {
    authEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint:  'https://accounts.spotify.com/api/token'
}
app.get('/', (req, res) => {
    res.render('home')
});

let access_token = null
app.use(session({
    name: 'SESSION_ID',
    secret: process.env.secret,
    resave: false,
    saveUninitialized: false,
    store: new FileStore
  }))

app.get('/authorize', (req, res) => {
    access_token = null
    let state 
    crypto.randomBytes(20, (err, buf) => {
    if (err) throw err;
    state = buf.toString('hex')
    });
    req.session.state = state
const authorizeUrl = buildUrl(authProvider.authEndpoint, {
    queryParams: {
        client_id: client.client_id,
        redirect_uri: client.redirect_uri,
        state: state,
        response_type: "code",
        scope: "user-top-read"
    }
});
    res.redirect(authorizeUrl);
})
const stringToBase64 = (clientId, clientSecret) => {
    const str = `${clientId}:${clientSecret}`
    const buff = Buffer.from(str, 'utf8');
    return buff.toString('base64');
}
app.get('/callback', (req, res) =>{
    if(req.query.state !== req.session.state) {
        res.render('error', {error: 'State doesn\'t match'})
    }
    const code = req.query.code;
    const accessToken = async () => {
        try {
            const response = await axios({
                method: 'post',
                url: authProvider.tokenEndpoint,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + stringToBase64(client.client_id, client.client_secret)
                },
                data: querystring.stringify({
                    code,
                    grant_type: "authorization_code",
                    redirect_uri: client.redirect_uri
                })
            })
            console.log(response.data)
            access_token = response.data.access_token
            res.redirect('/welcome')
        } catch (err) {
            console.log(err)
            return
        }
    }
    accessToken()   
})
app.get('/welcome', (req, res) => {
if(!access_token) {
    res.redirect('/')
} else {
    const fetch_lists = async () => {
        const axiosInstance = axios.create ({
            baseURL : 'https://api.spotify.com/v1/me/top/',
            headers: {
                'Authorization': 'Bearer ' + access_token
                }
          })
        try{
            const [response1, response2] = await Promise.all([
                axiosInstance.get('tracks?time_range=short_term&limit=25'),
                axiosInstance.get('artists?time_range=short_term&limit=25')
            ])
            console.log(response1)
            res.render('welcome', {tracks: response1.data.items, artists: response2.data.items})
        } catch (error) {
            res.render('error', {error: error.response.data.message})
        }   
    }
    fetch_lists()
}
})
app.listen(port, () => {
    console.log(`Spotylistslistening at http://localhost:${port}`)
  })