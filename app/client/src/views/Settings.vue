<template>
<div>
    <h1 class='pb-2'>Settings</h1>
    <v-list>
        <v-select 
            class='px-4'
            label='Streaming Quality' 
            persistent-hint
            :items='qualities'
            @change='updateStreamingQuality'
            v-model='streamingQuality'
        ></v-select>

        <v-select 
            class='px-4'
            label='Download Quality' 
            persistent-hint
            :items='qualities'
            @change='updateDownloadQuality'
            v-model='downloadQuality'
        ></v-select>

        <!-- Download path -->
        <v-text-field 
            class='px-4' 
            label='Downloads Directory'
            v-model='$root.settings.downloadsPath'
            append-icon='mdi-open-in-app'
            @click:append='selectDownloadPath'
        ></v-text-field>

        <!-- Create artist folder -->
        <v-list-item>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.createArtistFolder'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>Create folders for artists</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        <!-- Create album folder -->
        <v-list-item>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.createAlbumFolder'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>Create folders for albums</v-list-item-title>
            </v-list-item-content>
        </v-list-item>

        <!-- Download naming -->
        <v-text-field
            class='px-4 mb-2'
            label='Download Filename'
            persistent-hint
            v-model='$root.settings.downloadFilename'
            hint='Variables: %title%, %artists%, %artist%, %feats%, %trackNumber%, %0trackNumber%, %album%'
        ></v-text-field>

        <!-- Log listening -->
        <v-list-item>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.logListen'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>Log track listens to Deezer</v-list-item-title>
                <v-list-item-subtitle>This allows listening history, flow and recommendations to work properly.</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
        <!-- LastFM -->
        <v-list-item @click='connectLastFM' v-if='!$root.settings.lastFM'>
            <v-list-item-content>
                <v-list-item-title>Login with LastFM</v-list-item-title>
                <v-list-item-subtitle>Connect your LastFM account to allow scrobbling.</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>

        <!-- Minimize to tray -->
        <v-list-item v-if='$root.settings.electron'>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.minimizeToTray'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>Minimize to tray</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        <!-- Close on exit -->
        <v-list-item v-if='$root.settings.electron'>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.closeOnExit'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>Close on exit</v-list-item-title>
                <v-list-item-subtitle>Don't minimize to tray</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>

        <!-- Logout -->
        <v-btn block color='red' class='mt-4' @click='logout'>
            <v-icon>mdi-logout</v-icon>
            Logout
        </v-btn>

    </v-list>

    <v-btn class='my-4' large color='primary' :loading='saving' block @click='save'>
        <v-icon>mdi-content-save</v-icon>
        Save
    </v-btn>

</div>
</template>

<script>
export default {
    name: 'Settings',
    data() {
        return {
            saving: false,
            qualities: [
                'MP3 128kbps',
                'MP3 320kbps',
                'FLAC ~1441kbps'
            ],
            streamingQuality: null,
            downloadQuality: null,
            devToolsCounter: 0
        }
    },
    methods: {
        //Save settings
        save() {
            this.saving = true;
            this.$root.saveSettings();
            //Artificial wait to make it seem like something happened.
            setTimeout(() => {this.saving = false;}, 500);
        },
        getQuality(v) {
            let i = this.qualities.indexOf(v);
            if (i == 0) return 1;
            if (i == 1) return 3;
            if (i == 2) return 9;
            return 3;
        },
        //Update streaming quality
        updateStreamingQuality(v) {
            this.$root.settings.streamQuality = this.getQuality(v);
        },
        updateDownloadQuality(v) {
            this.$root.settings.downloadsQuality = this.getQuality(v);
        },
        //Quality to show currently selected quality
        getPresetQuality(q) {
            if (q == 9) return this.qualities[2];
            if (q == 3) return this.qualities[1];
            if (q == 1) return this.qualities[0];
            return this.qualities[1];
        },
        //Select download path, electron only
        selectDownloadPath() {
            //Electron check
            if (!this.$root.settings.electron) {
                alert('Available only in Electron version!');
                return;
            }
            const {ipcRenderer} = window.require('electron');
            ipcRenderer.on('selectDownloadPath', (event, newPath) => {
                if (newPath) this.$root.settings.downloadsPath = newPath;
            });
            ipcRenderer.send('selectDownloadPath');
        },
        async logout() {
            this.$root.settings.arl = null;
            await this.$root.saveSettings();
            location.reload();
        },
        //Redirect to lastfm login
        async connectLastFM() {
            let res = await this.$axios.get('/lastfm');
            window.location.replace(res.data.url);
        }
    },
    mounted() {
        this.streamingQuality = this.getPresetQuality(this.$root.settings.streamQuality);
        this.downloadQuality = this.getPresetQuality(this.$root.settings.downloadsQuality);

        //Press 'f' 10 times, to open dev tools
        document.addEventListener('keyup', (event) => {
            if (event.keyCode === 70) {
                this.devToolsCounter += 1;
            } else {
                this.devToolsCounter = 0;
            }
            if (this.devToolsCounter == 10) {
                this.devToolsCounter = 0;
                if (this.$root.settings.electron) {
                    const {remote} = window.require('electron');
                    remote.getCurrentWindow().toggleDevTools();
                }
            }
        });
    }
}
</script>