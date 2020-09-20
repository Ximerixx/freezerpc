const {app, BrowserWindow, ipcMain, Tray, Menu, session, dialog, shell} = require('electron');
const {createServer} = require('./src/server');
const path = require('path');

let win;
let tray;
let settings;

let shouldExit = false;

//Get path to asset
function assetPath(a) {
    return path.join(__dirname, 'assets', a);
}

async function createWindow() {
    //Start server
    settings = await createServer(true, (e) => {
        //Server error
        shouldExit = true;
        if (win) win.close();

        dialog.showMessageBoxSync({
            type: 'error',
            title: 'Server error',
            message: 'Server error occured, Freezer is probably already running!',
            buttons: ['Close']
        });
    });

    //Create window
    win = new BrowserWindow({
        width: settings.width,
        darkTheme: true,
        height: settings.height,
        minWidth: 620,
        minHeight: 600,
        resizable: true,
        autoHideMenuBar: true,
        icon: assetPath("icon.png"),
        title: 'Freezer',
        webPreferences: {
            enableRemoteModule: true,
            nodeIntegration: true,
            devTools: true
        }
    });

    win.loadURL(`http://localhost:${settings.port}`);

    //Minimize to tray
    win.on('minimize', (event) => {
        if (settings.minimizeToTray) {
            event.preventDefault();
            win.hide();
        }
    });

    //On close
    win.on('close', async (event) => {
        if (shouldExit) {
            win = null;
            tray = null;
            return true;
        }

        //Normal exit
        if (!settings || !settings.arl || settings.arl == '' || settings.closeOnExit) {
            win.webContents.send('onExit');
            shouldExit = true;
        }
        event.preventDefault();
        win.hide();
        return false;
    });

}

//Create window
app.on('ready', async () => {
    createWindow();

    //Create tray
    tray = new Tray(assetPath("icon-taskbar.png"));
    tray.on('double-click', () => win.show());
    tray.on('click', () => win.show());

    //Tray menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Restore', 
            type: 'normal',
            click: () => win.show()
        },
        {
            label: 'Play/Pause',
            type: 'normal',
            click: () => win.webContents.send('togglePlayback')
        },
        {
            label: 'Next',
            type: 'normal',
            click: () => win.webContents.send('skipNext')
        },
        {
            label: 'Previous',
            type: 'normal',
            click: () => win.webContents.send('skipPrev')
        },
        {
            label: 'Exit',
            type: 'normal',
            click: () => {
                shouldExit = true;
                win.close();
            }
        }
    ]);
    tray.setContextMenu(contextMenu);
});

//Update settings from ui
ipcMain.on('updateSettings', (event, args) => {
    Object.assign(settings, args);
});

//onExit callback
ipcMain.on('onExit', (event) => {
    shouldExit = true;
    win.close();
});

//Open downloads directory
ipcMain.on('openDownloadsDir', async (event) => {
    if ((await shell.openPath(settings.downloadsPath)) == "") return;
    shell.showItemInFolder(settings.downloadsPath);
});

//Download path picker
ipcMain.on('selectDownloadPath', async (event) => {
    let res = await dialog.showOpenDialog({
        title: 'Downloads folder',
        properties: ['openDirectory', 'promptToCreate'],
    });
    if (!res.canceled && res.filePaths.length > 0) {
        event.reply('selectDownloadPath', res.filePaths[0]);
    }
});

//Login using browser
ipcMain.on('browserLogin', async (event) => {
    //Initial clean
    session.defaultSession.clearStorageData();

    let lwin = new BrowserWindow({
        width: 800,
        height: 600,
        icon: assetPath('icon.png'),
        title: "Deezer Login",
        resizable: true,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false
        }
    });
    lwin.loadURL('https://deezer.com/login');

    let arl = await new Promise((res) => {
        lwin.webContents.on('did-navigate', async () => {
            let arlCookie = await session.defaultSession.cookies.get({
                name: "arl"
            });
            if (arlCookie.length > 0) {
                res(arlCookie[0].value);
            }
        });
    });

    lwin.close();
    lwin = null;
    //Delete deezer junk
    session.defaultSession.clearStorageData();
    
    event.reply('browserLogin', arl);
});