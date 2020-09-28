const crypto = require('crypto');
const axios = require('axios');
const decryptor = require('nodeezcryptor');
const querystring = require('querystring');
const {Transform} = require('stream');
const {Track} = require('./definitions');
const logger = require('./winston');

class DeezerAPI {

    constructor(arl, electron = false) {
        this.arl = arl;
        this.electron = electron;
        this.url = 'https://www.deezer.com/ajax/gw-light.php';
    }

    //Get headers
    headers() {
        let cookie = `arl=${this.arl}`;
        if (this.sid) cookie += `; sid=${this.sid}`;
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36",
            "Content-Language": "en-US",
            "Cache-Control": "max-age=0",
            "Accept": "*/*",
            "Accept-Charset": "utf-8,ISO-8859-1;q=0.7,*;q=0.3",
            "Accept-Language": "en-US,en;q=0.9,en-US;q=0.8,en;q=0.7",
            "Connection": 'keep-alive',
            "Cookie": cookie
        }
    }

    //Wrapper for api calls, because axios doesn't work reliably with electron
    async callApi(method, args = {}, gatewayInput = null) {
        if (this.electron) return await this._callApiElectronNet(method, args, gatewayInput);
        return await this._callApiAxios(method, args, gatewayInput);
    }

    //gw_light api call using axios, unstable in electron
    async _callApiAxios(method, args = {}, gatewayInput = null) {
        let data = await axios({
            url: this.url,
            method: 'POST',           
            headers: this.headers(),
            responseType: 'json',
            params: Object.assign({
                api_version: '1.0',
                api_token: this.token ? this.token : 'null',
                input: '3',
                method: method,
            },
                gatewayInput ? {gateway_input: JSON.stringify(gatewayInput)} : null
            ),
            data: args
        });

        //Save SID cookie to not get token error
        if (method == 'deezer.getUserData') {
            let sidCookie = data.headers['set-cookie'].filter((e) => e.startsWith('sid='));
            if (sidCookie.length > 0) {
                sidCookie = sidCookie[0].split(';')[0];
                this.sid = sidCookie.split('=')[1];
            }
        }


        return data.data;
    }

    //gw_light api call using electron net
    async _callApiElectronNet(method, args = {}, gatewayInput = null) {
        const net = require('electron').net;
        let data = await new Promise((resolve, reject) => {
            //Create request
            let req = net.request({
                method: 'POST',
                url: this.url + '?' + querystring.stringify(Object.assign({
                    api_version: '1.0',
                    api_token: this.token ? this.token : 'null',
                    input: '3',
                    method: method,
                },
                    gatewayInput ? {gateway_input: JSON.stringify(gatewayInput)} : null
                )),
            });
            
            req.on('response', (res) => {
                let data = Buffer.alloc(0);

                //Save SID cookie
                if (method == 'deezer.getUserData') {
                    let sidCookie = res.headers['set-cookie'].filter((e) => e.startsWith('sid='));
                    if (sidCookie.length > 0) {
                        sidCookie = sidCookie[0].split(';')[0];
                        this.sid = sidCookie.split('=')[1];
                    }
                }

                //Response data
                res.on('data', (buffer) => {
                    data = Buffer.concat([data, buffer]);
                });
                res.on('end', () => {
                    resolve(data);
                })
            });
            req.on('error', (err) => {
                reject(err);
            });

            //Write headers
            let headers = this.headers();
            for(let key of Object.keys(headers)) {
                req.setHeader(key, headers[key]);
            }
            req.write(JSON.stringify(args));
            req.end();
        });

        data = JSON.parse(data.toString('utf-8'));
        return data;
    }

    //true / false if success
    async authorize() {
        let data = await this.callApi('deezer.getUserData');
        this.token = data.results.checkForm;
        this.userId = data.results.USER.USER_ID;

        if (!this.userId || this.userId == 0 || !this.token) return false;
        return true;
    }

    //Get track URL
    static getUrl(trackId, md5origin, mediaVersion, quality = 3) {
        const magic = Buffer.from([0xa4]);
        let step1 = Buffer.concat([
            Buffer.from(md5origin),
            magic,
            Buffer.from(quality.toString()),
            magic,
            Buffer.from(trackId),
            magic,
            Buffer.from(mediaVersion)
        ]);
        //MD5
        let md5sum = crypto.createHash('md5');
        md5sum.update(step1);
        let step1md5 = md5sum.digest('hex');

        let step2 = Buffer.concat([
            Buffer.from(step1md5),
            magic,
            step1,
            magic
        ]);
        //Padding
        while(step2.length%16 > 0) {
            step2 = Buffer.concat([step2, Buffer.from('.')]);
        }
        //AES
        let aesCipher = crypto.createCipheriv('aes-128-ecb', Buffer.from('jo6aey6haid2Teih'), Buffer.from(''));
        let step3 = Buffer.concat([aesCipher.update(step2, 'binary'), aesCipher.final()]).toString('hex').toLowerCase();

        return `https://e-cdns-proxy-${md5origin.substring(0, 1)}.dzcdn.net/mobile/1/${step3}`;
    }

    //Quality fallback
    async qualityFallback(info, quality = 3) {
        if (quality == 1) return {
            quality: '128kbps',
            format: 'MP3',
            source: 'stream',
            url: `/stream/${info}?q=1`
        };
        try {
            let tdata = Track.getUrlInfo(info);
            let res = await axios.head(DeezerAPI.getUrl(tdata.trackId, tdata.md5origin, tdata.mediaVersion, quality));
            if (quality == 3) {
                return {
                    quality: '320kbps',
                    format: 'MP3',
                    source: 'stream',
                    url: `/stream/${info}?q=3`
                }
            }
            //Bitrate will be calculated in client
            return {
                quality: res.headers['content-length'],
                format: 'FLAC',
                source: 'stream',
                url: `/stream/${info}?q=9`
            }
        } catch (e) {
            logger.warn('Qualiy fallback: ' + e);
            //Fallback
            //9 - FLAC
            //3 - MP3 320
            //1 - MP3 128
            let q = quality;
            if (quality == 9) q = 3;
            if (quality == 3) q = 1;
            return this.qualityFallback(info, q);
        }
    }
}

class DeezerDecryptionStream extends Transform {

    constructor(trackId, options = {offset: 0}) {
        super();
        //Offset as n chunks
        this.offset = Math.floor(options.offset / 2048);
        //How many bytes to drop
        this.drop = options.offset % 2048;
        this.buffer = Buffer.alloc(0);

        this.key = decryptor.getKey(trackId);
    }

    _transform(chunk, encoding, next) {
        //Restore leftovers
        chunk = Buffer.concat([this.buffer, chunk]);

        while (chunk.length >= 2048) {
            //Decrypt
            let slice = chunk.slice(0, 2048);
            if ((this.offset % 3) == 0) {
                slice = decryptor.decryptBuffer(this.key, slice);
            }
            this.offset++;

            //Cut bytes
            if (this.drop > 0) {
                slice = slice.slice(this.drop);
                this.drop = 0;
            }
            
            this.push(slice);

            //Replace original buffer
            chunk = chunk.slice(2048);
        }
        //Save leftovers
        this.buffer = chunk;
        
        next();
    }

    //Last chunk
    async _flush(cb) {
        //drop should be 0, so it shouldnt affect
        this.push(this.buffer.slice(this.drop));
        this.drop = 0;
        this.buffer = Buffer.alloc(0);
        cb();
    }
}


module.exports = {DeezerAPI, DeezerDecryptionStream};