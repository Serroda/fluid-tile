import { Blocklist } from "./blocklist.mjs";
import { Shortcuts } from "./shortcuts.mjs";
import { Tiles } from "./tiles.mjs";
import { UI } from "./ui.mjs";
import { Userspace } from "./userspace.mjs";
import { Windows } from "./windows.mjs";
import { Desktops } from "./desktops.mjs";

export class Engine {
  constructor(
    workspace,
    config,
    {
      root,
      timerExtendDesktop,
      timerRemoveDesktop,
      timerCurrentDesktopChanged,
      timerResetAll,
      timerHideUI,
      windowFullscreen,
      windowPopup,
    },
  ) {
    this.state = {
      avoidChildChanged: false,
    };
    this.workspace = workspace;
    this.config = config;
    this.root = root;
    this.windowsUI = {
      windowFullscreen,
      windowPopup,
    };
    this.timers = {
      extendDesktop: timerExtendDesktop,
      removeDesktop: timerRemoveDesktop,
      currentDesktopChanged: timerCurrentDesktopChanged,
      resetAll: timerResetAll,
      hideUI: timerHideUI,
    };
    this.classes = {
      blocklist: new Blocklist(config),
      userspace: new Userspace(workspace),
      tiles: new Tiles(workspace, config),
    };
    this.classes.windows = new Windows(
      workspace,
      config,
      this.classes,
      timerExtendDesktop,
    );
    this.classes.desktops = new Desktops(
      workspace,
      config,
      this.classes,
      timerRemoveDesktop,
    );
    this.classes.ui = new UI(
      workspace,
      config,
      root,
      this.classes,
      this.windowsUI.windowFullscreen,
      this.windowsUI.windowPopup,
      timerHideUI,
    );
    this.classes.shortcuts = new Shortcuts(
      workspace,
      config,
      root,
      this.classes,
      timerResetAll,
    );
  }

  //Trigger when a window is added to the desktop
  onWindowAdded(window) {
    if (this.classes.blocklist.check(window) === true) {
      return;
    }

    const continueProcess = this.classes.windows.setTilesOnAdd(window);

    if (this.config.desktopAdd === true && continueProcess === true) {
      this.classes.desktops.avoidDesktopChanged = true;
      window.desktops = [this.classes.desktops.create(true)];

      const tilesOrdered = this.classes.tiles.getTilesCurrentDesktop();

      if (this.config.maximizeExtend === true) {
        window.setMaximize(true, true);
        window._tileShadow = tilesOrdered[0];
      } else {
        window.setMaximize(false, false);
        window._avoidTileChangedTrigger = false;
        tilesOrdered[0].manage(window);
      }
    }

    this.classes.desktops.checkDesktopExtra();
  }

  //Trigger when a window is remove to the desktop
  onWindowRemoved(window) {
    if (this.classes.blocklist.check(window) === true) {
      return;
    }

    const continueProcess = this.classes.windows.setTilesOnRemove(window);

    this.classes.blocklist.removeWindow(window);

    if (continueProcess === false) {
      this.classes.windows.focus();
    } else {
      this.classes.desktops.remove({
        desktopsId: window.desktops.map((d) => d.id),
        windowIgnore: window,
      });
    }
  }

  //Set signals to all Windows
  setWindowsSignals() {
    for (const windowItem of this.workspace.stackingOrder) {
      this.setSignalsToWindow(windowItem);
    }
  }

  //Set signals to window
  setSignalsToWindow(window) {
    if (this.classes.blocklist.check(window) === true) {
      return;
    }

    if (window._signals !== undefined) {
      for (const key in window._signals) {
        window[key].disconnect(window._signals[key]);
      }
    }

    window._signals = {
      maximizedAboutToChange: this.onMaximizeAboutToChanged.bind(this, window),
      minimizedChanged: this.onMinimizedChanged.bind(this, window),
      interactiveMoveResizeStarted: this.classes.ui.onUserMoveStart.bind(
        this.classes.ui,
        window,
      ),
      interactiveMoveResizeStepped: this.classes.ui.onUserMoveStepped.bind(
        this.classes.ui,
        window,
      ),
      interactiveMoveResizeFinished: this.classes.ui.onUserMoveFinished.bind(
        this.classes.ui,
        window,
      ),
    };

    for (const key in window._signals) {
      window[key].connect(window._signals[key]);
    }
  }

  //When a window tile is changed, exchange windows and extend windows
  onWindowAddedToTile(tile, window) {
    //Trigger when a window is maximized but not minimized
    //when a window exchange
    if (
      this.classes.blocklist.check(window) === true ||
      this.classes.ui.checkIfUIVisible() === true ||
      window._avoidTileChangedTrigger === true ||
      window._tileShadow === undefined
    ) {
      window._avoidTileChangedTrigger =
        window._avoidTileChangedTrigger === true
          ? false
          : window._avoidTileChangedTrigger;
      window._tileShadow = tile;
      return;
    }

    const windowsOther = this.classes.windows
      .getAll(window)
      .filter(
        (w) =>
          w.minimized === false && (w.tile === tile || w._tileShadow === tile),
      );

    if (windowsOther.length > 0) {
      this.classes.tiles.exchangeTiles(windowsOther, window._tileShadow);
    }

    if (this.workspace.currentDesktop !== window._tileShadow._desktop) {
      this.classes.desktops.desktopsExtend.add(window._tileShadow._desktop);
    }

    //Start delay only when you have to exchange in another screen
    if (window._tileShadow._screen !== this.workspace.activeScreen) {
      this.timers.extendDesktop.interval =
        this.config.windowsExtendTileChangedDelay;
      this.timers.extendDesktop.start();
    } else if (
      this.classes.tiles.getTilesCurrentDesktop().length >
        windowsOther.length + 1 ||
      window._maximized === false
    ) {
      //Start timer without delay, if you dont execute `extendWindows` inside
      //QTimer, `extendWindows` doesnt get the correct position of the windows
      this.timers.extendDesktop.interval = 0;
      this.timers.extendDesktop.start();
    }

    window._tileShadow = tile;
  }

  //When window is not maximized, set a previous tile
  onMaximizeAboutToChanged(window, mode) {
    window._maximized = mode === 3;

    //When a window is maximized window.tile is always null
    if (
      this.classes.blocklist.check(window) === true ||
      this.classes.ui.checkIfUIVisible() === true ||
      window._maximized === true ||
      window._avoidMaximizeTrigger === true ||
      window._tileShadow === undefined ||
      window.tile !== null
    ) {
      window._avoidMaximizeTrigger =
        window._avoidMaximizeTrigger === true
          ? false
          : window._avoidMaximizeTrigger;
      return;
    }

    //If not fullscreen
    if (
      window.tile !== window._tileShadow &&
      window._avoidManageTileMaximize !== true
    ) {
      window._avoidTileChangedTrigger = false;
      window._avoidMaximizeExtend = true;
      window._avoidManageTileMaximize = true;
      window._tileShadow.manage(window);
    } else {
      window._avoidManageTileMaximize = false;
    }
  }

  //When a window is minimized, extend windows
  onMinimizedChanged(window) {
    if (this.classes.blocklist.check(window) === true) {
      return;
    }

    if (window.desktops.includes(this.workspace.currentDesktop) === false) {
      this.classes.desktops.desktopsExtend.add(window.desktops[0]);
      return;
    }

    window._avoidMaximizeTrigger = true;
    window.setMaximize(false, false);
    this.classes.windows.extendCurrentDesktop(true);
  }

  //Delete virtual desktop timer
  onTimerRemoveDesktopFinished(info) {
    this.classes.desktops.onTimerRemoveFinished(info);
  }

  //Extend windows when timer finish
  onTimerExtendDesktopFinished() {
    this.classes.windows.extendCurrentDesktop(true);
  }

  //Focus window or set window tile when timer finish
  onTimerCurrentDesktopChangedFinished() {
    this.classes.desktops.onTimerCurrentDesktopChangedFinished(
      this.classes.ui.checkIfUIVisible(),
    );
  }

  //Extend windows when timer finish
  onTimerResetAllFinished(screenAll) {
    this.classes.windows.resetAll(screenAll);
    this.setTilesSignals();
    this.classes.windows.reconnectSignals();
    this.state.avoidChildChanged = false;
  }

  //Hide ui when timer finished
  onTimerHideUIFinished(ui, rootHide) {
    this.classes.ui.hide(ui, rootHide);
  }

  // Focus window when a current desktop is changed
  onCurrentDesktopChanged() {
    this.classes.ui.resetLayout();
    this.setTilesSignals();
    if (this.classes.ui.checkIfUIVisible() === false) {
      this.classes.desktops.checkDesktopExtra();
    }
    this.timers.currentDesktopChanged.start();
  }

  //Reextend window when desktop is added or removed
  onDesktopsChanged() {
    this.classes.desktops.onDesktopsChanged();
  }

  //Set signal to tiles
  setTilesSignals() {
    for (const screen of this.workspace.screens) {
      const rootTile = this.classes.tiles.getRootTile(undefined, screen);

      if (rootTile === null) {
        return;
      }

      if (rootTile._signals !== undefined) {
        for (const key in rootTile._signals) {
          rootTile[key].disconnect(rootTile._signals[key]);
        }
      }

      rootTile._signals = {
        childTilesChanged: this.onChildTilesChanged.bind(this),
        windowAdded: this.onWindowAddedToTile.bind(this, rootTile),
      };

      for (const key in rootTile._signals) {
        rootTile[key].connect(rootTile._signals[key]);
      }
    }

    const tiles = this.classes.tiles.getTilesCurrentDesktop();

    for (const tile of tiles) {
      if (tile._signals !== undefined) {
        for (const key in tile._signals) {
          tile[key].disconnect(tile._signals[key]);
        }
      }

      tile._signals = {
        childTilesChanged: this.onChildTilesChanged.bind(this),
        windowAdded: this.onWindowAddedToTile.bind(this, tile),
      };

      for (const key in tile._signals) {
        tile[key].connect(tile._signals[key]);
      }
    }
  }

  //When a tile is added or removed in KWin tile manager by hand
  //reset windows
  onChildTilesChanged() {
    if (this.state.avoidChildChanged === true) {
      return;
    }
    this.state.avoidChildChanged = true;
    this.classes.windows.disconnectSignals();
    this.classes.tiles.disconnectSignals();
    this.timers.resetAll.screenAll = true;
    this.timers.resetAll.start();
  }
}
