import QtQuick
import org.kde.kwin
import "../code/util.js" as Util

Item {
    id: root
    property var config: ({})
    property var removeDesktopInfo: ({})

    // Load user config
    function loadConfig() {
        config = {
            appsBlocklist: KWin.readConfig("AppsBlocklist", "org.kde.kded6,qt-sudo,org.kde.polkit-kde-authentication-agent-1,org.kde.spectacle,kcm_kwinrules,org.freedesktop.impl.portal.desktop.kde,krunner,plasmashell,org.kde.plasmashell,kwin_wayland,ksmserver-logout-greeter"),
            tilesPriority: KWin.readConfig("TilesPriority", "Width,Height,Top,Left,Right,Bottom").split(","),
            maximizeClose: KWin.readConfig("MaximizeClose", true),
            maximizeOpen: KWin.readConfig("MaximizeOpen", true),
            windowsOrderClose: KWin.readConfig("WindowsOrderClose", true),
            desktopAdd: KWin.readConfig("DesktopAdd", true),
            desktopRemove: KWin.readConfig("DesktopRemove", true),
            desktopRemoveDelay: KWin.readConfig("DesktopRemoveDelay", 300),
            modalsIgnore: KWin.readConfig("ModalsIgnore", true),
            layoutDefault: KWin.readConfig("LayoutDefault", 2)
        };
    }

    //Prepare for set tile layout
    function setLayout(desktop, screen, layout) {
        const tileRoot = Workspace.rootTile(screen, desktop);
        tileRoot.tiles.forEach(tile => tile.remove());
        return Util.setTiles(tileRoot.tiles[0], layout);
    }

    //Get tiles from the screen and virtual desktop
    function getOrderedTiles(desktop, screen) {
        const tileRoot = Workspace.rootTile(screen, desktop);
        return Util.orderTiles(tileRoot.tiles, config.tilesPriority);
    }

    // Get all windows from the virtual desktop except the given window
    function getWindows(windowMain, desktop, screen) {
        const windows = [];

        for (const windowItem of Workspace.stackingOrder) {
            if (windowItem !== windowMain && windowItem.output === screen && windowItem.desktops.includes(desktop) === true && Util.checkBlocklist(windowItem, config.appsBlocklist, config.modalsIgnore) === false) {
                windows.push(windowItem);
            }
        }

        return windows;
    }

    // Set window tiles
    // mode: 0 => addWindow
    // mode: 1 => removeWindow
    function setWindowsTiles(windowMain, desktops, screens, maximize, mode) {
        for (const itemDesktop of desktops) {
            for (const itemScreen of screens) {
                const windowsOther = getWindows(windowMain, itemDesktop, itemScreen);
                const tilesOrdered = getOrderedTiles(itemDesktop, itemScreen);

                if (mode === 0) {
                    if (windowsOther.length === 0) {
                        Workspace.currentDesktop = itemDesktop;
                        windowMain.desktops = [itemDesktop];

                        if (maximize === true) {
                            windowMain.setMaximize(true, true);
                        } else {
                            windowMain.setMaximize(false, false);
                            tilesOrdered[0].manage(windowMain);
                        }

                        return false;
                    }
                } else if (mode === 1) {
                    if (windowsOther.length === 1 && maximize === true) {
                        windowsOther[0].setMaximize(true, true);
                        return false;
                    }
                }

                if (mode === 1 && config.windowsOrderClose === false) {
                    return true;
                }

                if (mode === 0) {
                    //Set tile if the custom mosaic has space
                    if (windowsOther.length + 1 <= tilesOrdered.length) {
                        Workspace.currentDesktop = itemDesktop;
                        windowMain.desktops = [itemDesktop];
                        windowMain.setMaximize(false, false);
                        tilesOrdered[0].manage(windowMain);
                        for (let x = 0; x < windowsOther.length; x++) {
                            windowsOther[x].desktops = [itemDesktop];
                            windowsOther[x].setMaximize(false, false);
                            tilesOrdered[x + 1].manage(windowsOther[x]);
                        }
                        return false;
                    }
                } else if (mode === 1 && windowsOther.length !== 0) {
                    for (let x = 0; x < windowsOther.length; x++) {
                        windowsOther[x].setMaximize(false, false);
                        tilesOrdered[x].manage(windowsOther[x]);
                    }
                    return false;
                }
            }
        }
        return true;
    }

    function onWindowAdded(windowNew) {
        if (Util.checkBlocklist(windowNew, config.appsBlocklist, config.modalsIgnore) === true) {
            return;
        }

        const continueProcess = setWindowsTiles(windowNew, Workspace.desktops, Workspace.screens, config.maximizeOpen, 0);

        if (config.desktopAdd === true && continueProcess === true) {
            Workspace.createDesktop(Workspace.desktops.length, "");
            Workspace.currentDesktop = Workspace.desktops[Workspace.desktops.length - 1];
            windowNew.desktops = [Workspace.currentDesktop];

            if (config.maximizeOpen === true) {
                windowNew.setMaximize(true, true);
            }

            setLayout(Workspace.currentDesktop, Workspace.activeScreen, Util.getDefaultLayouts(config.layoutDefault - 1));

            if (config.maximizeOpen === false) {
                const tilesOrdered = getOrderedTiles(Workspace.currentDesktop, Workspace.activeScreen);

                windowNew.setMaximize(false, false);
                tilesOrdered[0].manage(windowNew);
            }
        }
    }

    function onWindowRemoved(windowClosed) {
        if (Util.checkBlocklist(windowClosed, config.appsBlocklist, config.modalsIgnore) === true) {
            return;
        }

        const continueProcess = setWindowsTiles(windowClosed, windowClosed.desktops, [windowClosed.output], config.maximizeClose, 1);

        if (continueProcess === false || config.desktopRemove === false) {
            return;
        }

        removeDesktopInfo.desktopsId = windowClosed.desktops.map(d => d.id);
        removeDesktopInfo.screenId = windowClosed.output.serialNumber;
        removeDesktopInfo.windowClosed = windowClosed;
        timerRemoveDesktop.start();
    }

    Timer {
        id: timerRemoveDesktop
        interval: root.config.desktopRemoveDelay
        repeat: false
        running: false
        onTriggered: {
            //Case: Applications that open a window and, when an action is performed,
            //close the window and open another window (Chrome profile selector).
            //This timer avoid crash wayland
            const screen = Workspace.screens.find(s => s.serialNumber === root.removeDesktopInfo.screenId);
            if (screen === undefined) {
                return;
            }
            for (const desktopItem of Workspace.desktops.filter(d => root.removeDesktopInfo.desktopsId.includes(d.id))) {
                const windowsOtherSpecialCases = root.getWindows(root.removeDesktopInfo.windowClosed, desktopItem, screen);
                if (windowsOtherSpecialCases.length === 0) {
                    Workspace.removeDesktop(desktopItem);
                }
            }
            root.removeDesktopInfo = {};
        }
    }

    Component.onCompleted: {
        loadConfig();
        Workspace.windowAdded.connect(onWindowAdded);
        Workspace.windowRemoved.connect(onWindowRemoved);
    }
}
