import { Queue } from "./queue.mjs";

export class Desktops {
  constructor(workspace, config, { windows, tiles, timer }) {
    this.workspace = workspace;
    this.config = config;
    this.windows = windows;
    this.tiles = tiles;
    this.timer = timer;
    this.avoidDesktopChanged = false;
    this.desktopsExtend = new Queue();
  }

  create(focus = false, forceLast = false) {
    let position = this.workspace.desktops.length;

    if (forceLast === false) {
      switch (this.config.windowOverflowAction) {
        // After the current desktop
        case 0:
          position =
            this.workspace.desktops.indexOf(this.workspace.currentDesktop) + 1;
          break;
        // Before the current desktop
        case 1:
          position = this.workspace.desktops.indexOf(
            this.workspace.currentDesktop,
          );
          break;
        // Last
        case 2:
          position = this.workspace.desktops.length;
          break;
        // First
        case 3:
          position = 0;
          break;
      }
    }

    this.workspace.createDesktop(position, "");
    let layout = this.tiles.getDefaultLayouts(this.config.layoutDefault - 1);

    if (this.config.layoutCustom !== undefined) {
      layout = this.config.layoutCustom;
    }

    const desktopCreated = this.workspace.desktops[position];

    this.tiles.setLayout(desktopCreated, layout);

    if (focus === true) {
      this.workspace.currentDesktop = desktopCreated;
    }

    return desktopCreated;
  }

  remove(info) {
    this.timer.start(
      "removeDesktop",
      this.onTimerRemoveFinished.bind(this, info),
      this.config.desktopRemoveDelay,
    );
  }

  checkDesktopExtra() {
    if (this.config.desktopExtra === false) {
      return;
    }

    for (const screen of this.workspace.screens) {
      const windows = this.windows.getAll(
        undefined,
        this.workspace.desktops[this.workspace.desktops.length - 1],
        screen,
      );

      if (windows.length > 0) {
        this.create(false, true);
        return;
      }
    }
  }

  onTimerRemoveFinished(info) {
    if (
      this.config.desktopRemove === false ||
      this.workspace.desktops.length <= 1 ||
      this.workspace.desktops.length <= this.config.desktopRemoveMin
    ) {
      info = {
        windowIgnore: undefined,
        desktopsId: [],
      };
      this.checkDesktopExtra();
      return;
    }

    //Case: Applications that open a window and, when an action is performed,
    //close the window and open another window (Chrome profile selector).
    //This timer avoid crash wayland
    const desktopsRemove = [];

    desktopLoop: for (const desktopItem of this.workspace.desktops.filter((d) =>
      info.desktopsId.includes(d.id),
    )) {
      for (const screenItem of this.workspace.screens) {
        const windowsOtherSpecialCases = this.windows.getAll(
          info.windowIgnore,
          desktopItem,
          screenItem,
        );

        if (windowsOtherSpecialCases.length !== 0) {
          continue desktopLoop;
        }
      }

      desktopsRemove.push(desktopItem);
    }

    for (const desktop of desktopsRemove) {
      this.desktopsExtend.remove(desktop);
      this.workspace.removeDesktop(desktop);
    }

    info = {
      windowIgnore: undefined,
      desktopsId: [],
    };

    this.checkDesktopExtra();
  }

  onDesktopsChanged() {
    if (this.avoidDesktopChanged === true) {
      this.avoidDesktopChanged = false;
      return;
    }

    for (const desktop of this.workspace.desktops) {
      let extendDesktop = false;

      for (const screen of this.workspace.screens) {
        const windows = this.windows.getAll(undefined, desktop, screen);
        const tiles = this.tiles.getOrderedTiles(desktop, screen);

        if (windows.length === tiles.length || windows.length === 0) {
          continue;
        }

        extendDesktop = true;
      }

      if (extendDesktop === false) {
        continue;
      }

      if (desktop === this.workspace.currentDesktop) {
        this.windows.extendCurrentDesktop(true);
        continue;
      }

      this.desktopsExtend.add(desktop);
    }
  }

  onTimerCurrentDesktopChangedFinished(uiVisible) {
    const moved = this.windows.checkDesktopChanged();

    //Moved by shortcut
    if (moved === true && uiVisible === false) {
      if (this.workspace.activeWindow._tileShadow !== undefined) {
        this.remove({
          desktopsId: [this.workspace.activeWindow._tileShadow._desktop.id],
        });

        this.desktopsExtend.add(
          this.workspace.activeWindow._tileShadow._desktop,
        );
      }

      this.desktopsExtend.remove(this.workspace.currentDesktop);
      this.windows.setEmptyTile();
    } else {
      this.windows.focus();
    }

    if (this.desktopsExtend.exists(this.workspace.currentDesktop) === true) {
      this.windows.extendCurrentDesktop(true);
      this.desktopsExtend.remove(this.workspace.currentDesktop);
    }
  }

  checkEmptySpace(windowIgnore) {
    const screens = this.workspace.screens;
    const desktops = this.workspace.desktops;

    const indexStartDesktop = desktops.indexOf(this.workspace.currentDesktop);
    const indexStartScreen = screens.indexOf(this.workspace.activeScreen);

    if (indexStartDesktop === -1 || indexStartScreen === -1) {
      return null;
    }

    let indexDesktop = indexStartDesktop;
    let indexScreen = indexStartScreen;

    do {
      const itemDesktop = desktops[indexDesktop];
      do {
        const itemScreen = screens[indexScreen];

        const windows = this.windows.getAll(
          windowIgnore,
          itemDesktop,
          itemScreen,
        );

        const tiles = this.tiles.getOrderedTiles(itemDesktop, itemScreen);
        const nextLayout = this.tiles.checkNextLayout(itemDesktop, itemScreen);

        if (tiles.length <= windows.length) {
          if (
            this.config.windowOverflowPerScreen === true &&
            this.config.windowOverflowAction === 4 &&
            nextLayout !== undefined
          ) {
            return {
              desktop: itemDesktop,
              screen: itemScreen,
              nextLayout,
            };
          }

          indexScreen = (indexScreen + 1) % screens.length;
          continue;
        }

        return {
          desktop: itemDesktop,
          screen: itemScreen,
        };
      } while (indexScreen !== indexStartScreen);
      indexDesktop = (indexDesktop + 1) % desktops.length;
    } while (indexDesktop !== indexStartDesktop);

    if (this.config.windowOverflowAction !== 4) {
      return null;
    }

    indexDesktop = indexStartDesktop;
    indexScreen = indexStartScreen;

    do {
      const itemDesktop = desktops[indexDesktop];
      do {
        const itemScreen = screens[indexScreen];

        const nextLayout = this.tiles.checkNextLayout(itemDesktop, itemScreen);

        if (nextLayout !== undefined) {
          return {
            desktop: itemDesktop,
            screen: itemScreen,
            nextLayout,
          };
        }

        indexScreen = (indexScreen + 1) % screens.length;
        continue;
      } while (indexScreen !== indexStartScreen);
      indexDesktop = (indexDesktop + 1) % desktops.length;
    } while (indexDesktop !== indexStartDesktop);

    return null;
  }
}
