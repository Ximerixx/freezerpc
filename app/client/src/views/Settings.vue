<template>
<div>
    <h1 class='pb-2'>{{$t('Settings')}}</h1>
    <v-list>
        <v-select 
            class='px-4 mx-2'
            :label='$t("Streaming Quality")' 
            persistent-hint
            :items='qualities'
            @change='updateStreamingQuality'
            v-model='streamingQuality'
        ></v-select>

        <v-select 
            class='px-4 mx-2'
            :label='$t("Download Quality")' 
            persistent-hint
            :items='qualities'
            @change='updateDownloadQuality'
            v-model='downloadQuality'
        ></v-select>

        <!-- Download path -->
        <v-text-field 
            class='px-4 mx-2' 
            :label='$t("Downloads Directory")'
            v-model='$root.settings.downloadsPath'
            append-icon='mdi-open-in-app'
            @click:append='selectDownloadPath'
        ></v-text-field>

        <!-- Download threads -->
        <v-slider
            :label='$t("Simultaneous downloads")'
            min='1'
            max='16'
            thumb-label
            step='1'
            ticks
            dense
            class='px-4 mx-2'
            v-model='$root.settings.downloadThreads'
        ></v-slider>
        
        <!-- Download dialog -->
        <v-list-item>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.downloadDialog' class='pl-2'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>{{$t("Show download dialog")}}</v-list-item-title>
                <v-list-item-subtitle>{{$t("Always show download confirm dialog before downloading.")}}</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
        <!-- Create playlist folder -->
        <v-list-item>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.playlistFolder' class='pl-2'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>{{$t("Create folders for playlists")}}</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        <!-- Create artist folder -->
        <v-list-item>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.createArtistFolder' class='pl-2'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>{{$t("Create folders for artists")}}</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        <!-- Create album folder -->
        <v-list-item>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.createAlbumFolder' class='pl-2'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>{{$t("Create folders for albums")}}</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        <!-- Download lyrics -->
        <v-list-item>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.downloadLyrics' class='pl-2'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>{{$t("Download lyrics")}}</v-list-item-title>
            </v-list-item-content>
        </v-list-item>


        <!-- Download naming -->
        <v-text-field
            class='px-4 my-2'
            label='Download Filename'
            persistent-hint
            v-model='$root.settings.downloadFilename'
            :hint='$t("Variables") + ": %title%, %artists%, %artist%, %feats%, %trackNumber%, %0trackNumber%, %album%, %year%, %label%"'
        ></v-text-field>

        <!-- Crossfade -->
        <v-slider
            :label='$t("Crossfade (ms)")'
            min='0'
            max='10000'
            thumb-label
            step='500'
            ticks
            class='px-4 mt-4 mx-2'
            v-model='$root.settings.crossfadeDuration'
        ></v-slider>

        <!-- UI -->
        <v-subheader>{{$t("UI")}}</v-subheader>
        <v-divider></v-divider>

        <!-- Language -->
        <v-select 
            class='mt-2 px-4 mx-2'
            label='Language' 
            persistent-hint
            :items='languageNames'
            @change='updateLanguage'
        ></v-select>
        <!-- Primary color -->
        <v-list-item @click='colorPicker = true'>
            <v-list-item-avatar>
                <v-icon>mdi-palette</v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
                <v-list-item-title class='pl-2'>{{$t("Select primary color")}}</v-list-item-title>
            </v-list-item-content>
        </v-list-item>

        <!-- Autocomplete -->
        <v-list-item>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.showAutocomplete' class='pl-2'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>{{$t("Show autocomplete in search")}}</v-list-item-title>
            </v-list-item-content>
        </v-list-item>

        <!-- Light theme -->
        <v-list-item>
            <v-list-item-action>
                <v-checkbox class='pl-2' v-model='$root.settings.lightTheme' @change='changeLightTheme'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>{{$t("Light theme")}}</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        
        
        <!-- Accounts -->
        <v-subheader>{{$t("Integrations")}}</v-subheader>
        <v-divider></v-divider>

        <!-- Log listening -->
        <v-list-item>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.logListen' class='pl-2'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>{{$t("Log track listens to Deezer")}}</v-list-item-title>
                <v-list-item-subtitle>{{$t("This allows listening history, flow and recommendations to work properly.")}}</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
        <!-- LastFM -->
        <v-list-item @click='connectLastFM' v-if='!$root.settings.lastFM'>
            <v-list-item-avatar>
                <v-img src='lastfm.svg'></v-img>
            </v-list-item-avatar>
            <v-list-item-content>
                <v-list-item-title class='pl-2'>{{$t("Login with LastFM")}}</v-list-item-title>
                <v-list-item-subtitle class='pl-2'>{{$t("Connect your LastFM account to allow scrobbling.")}}</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
        <v-list-item v-if='$root.settings.lastFM' @click='disconnectLastFM'>
            <v-list-item-avatar>
                <v-icon>mdi-logout</v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
                <v-list-item-title class='red--text'>{{$t("Disconnect LastFM")}}</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        <!-- Discord -->
        <v-list-item>
            <v-list-item-action>
                <v-checkbox class='pl-2' v-model='$root.settings.enableDiscord' @click='snackbarText = $t("Requires restart to apply!"); snackbar = true'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>{{$t("Discord Rich Presence")}}</v-list-item-title>
                <v-list-item-subtitle>{{$t("Enable Discord Rich Presence, requires restart to toggle!")}}</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
        <!-- Discord Join Button -->
        <v-list-item>
            <v-list-item-action>
                <v-checkbox class='pl-2' v-model='$root.settings.discordJoin' @click='snackbarText = $t("Requires restart to apply!"); snackbar = true'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>{{$t("Discord Join Button")}}</v-list-item-title>
                <v-list-item-subtitle>{{$t("Enable Discord join button for syncing tracks, requires restart to toggle!")}}</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>

        <!-- Misc -->
        <v-subheader>{{$t("Other")}}</v-subheader>
        <v-divider></v-divider>

        <!-- Minimize to tray -->
        <v-list-item v-if='$root.settings.electron'>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.minimizeToTray' class='pl-2'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>{{$t("Minimize to tray")}}</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        <!-- Close on exit -->
        <v-list-item v-if='$root.settings.electron'>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.closeOnExit' class='pl-2'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>{{$t("Close on exit")}}</v-list-item-title>
                <v-list-item-subtitle>{{$t("Don't minimize to tray")}}</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
        <!-- Force white tray icon -->
        <v-list-item v-if='$root.settings.electron'>
            <v-list-item-action>
                <v-checkbox v-model='$root.settings.forceWhiteTrayIcon' class='pl-2'></v-checkbox>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>{{$t("Force white tray icon")}}</v-list-item-title>
                <v-list-item-subtitle>{{$t("Force default (white) tray icon if theme incorrectly detected. Requires restart.")}}</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>

        <!-- Logout -->
        <v-btn block color='red' class='mt-4' @click='logout'>
            <v-icon>mdi-logout</v-icon>
            {{$t("Logout")}}
        </v-btn>

    </v-list>

    <v-btn fab color='primary' absolute bottom right class='mb-12' @click='save' :loading='saving'>
        <v-icon>mdi-content-save</v-icon>
    </v-btn>

    <!-- Info snackbar -->
    <v-snackbar v-model="snackbar">
      {{ snackbarText }}

      <template v-slot:action="{ attrs }">
        <v-btn
          color="primary"
          text
          v-bind="attrs"
          @click="snackbar = false"
        >
          Dismiss
        </v-btn>
      </template>
    </v-snackbar>

    <!-- Color picker overlay -->
    <v-overlay :value='colorPicker' elevation='2'>
        <v-card>
            <v-color-picker v-model='$root.settings.primaryColor' mode='hexa'></v-color-picker>
            <v-btn :color='$root.settings.primaryColor' block class='my-1 px-2' @click='saveColor'>
                Save
            </v-btn>
        </v-card>
    </v-overlay>

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
            devToolsCounter: 0,
            snackbarText: null,
            snackbar: false,
            language: 'en',
            languages: [
                {code: 'en', name: 'English'},
                {code: 'ar', name: 'Arabic'},
                {code: 'fr', name: 'French'},
                {code: 'de', name: 'German'},
                {code: 'el', name: 'Greek'},
                {code: 'id', name: 'Indonesian'},
                {code: 'it', name: 'Italian'},
                {code: 'pl', name: 'Polish'},
                {code: 'pt', name: 'Portuguese'},
                {code: 'ro', name: 'Romanian'},
                {code: 'ru', name: 'Russian'},
                {code: 'sk', name: 'Slovak'},
                {code: 'es', name: 'Spanish'},
                {code: 'tr', name: 'Turkish'},
                {code: 'uk', name: 'Ukrainian'}
            ],
            colorPicker: false,
            primaryColorIndex: 0,
            primaries: ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', 
                '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722',
                '#795548', '#607D8B', '#9E9E9E']
        }
    },
    methods: {
        //Save settings
        save() {
            this.saving = true;
            this.$root.saveSettings();
            //Artificial wait to make it seem like something happened.
            setTimeout(() => {this.saving = false;}, 500);
            this.snackbarText = this.$t("Settings saved!");
            this.snackbar = true;
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
                alert(this.$t("Available only in Electron version!"));
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
        },
        //Disconnect LastFM
        async disconnectLastFM() {
            this.$root.settings.lastFM = null;
            await this.$root.saveSettings();
            window.location.reload();
        },
        saveColor() {
            this.colorPicker = false;
            this.$vuetify.theme.themes.dark.primary = this.$root.settings.primaryColor;
            this.$vuetify.theme.themes.light.primary = this.$root.settings.primaryColor;
            this.$root.saveSettings();
        },
        updateLanguage(l) {
            let code = this.languages.filter(lang => lang.name == l)[0].code;
            this.language = code;
            this.$root.updateLanguage(code);
            this.$root.settings.language = code;
        },
        //Update light theme
        changeLightTheme(v) {
            this.$root.settings.lightTheme = v;
            if (v) {
                this.$vuetify.theme.dark = false;
                this.$vuetify.theme.light = true;
            } else {
                this.$vuetify.theme.dark = true;
                this.$vuetify.theme.light = false;
            }
        }
    },
    computed: {
        languageNames() {
            return this.languages.map(l => l.name);
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

            //RGB
            if (event.code == 'KeyG' && event.ctrlKey && event.altKey) {
                setInterval(() => {
                    this.$vuetify.theme.themes.dark.primary = this.primaries[this.primaryColorIndex];
                    this.$vuetify.theme.themes.light.primary = this.primaries[this.primaryColorIndex];
                    this.$root.settings.primaryColor = this.primaries[this.primaryColorIndex];
                    this.primaryColorIndex++;
                    if (this.primaryColorIndex == this.primaries.length)
                        this.primaryColorIndex = 0;
                }, 400);
            }
        });
    }
}
</script>