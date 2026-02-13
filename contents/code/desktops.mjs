import { Queue } from "./queue.mjs";

export class Desktops {
  constructor(workspace, config, { windows, tiles }, timerRemoveDesktop) {
    this.workspace = workspace;
    this.config = config;
    this.windows = windows;
    this.tiles = tiles;
    this.timerRemoveDesktop = timerRemoveDesktop;
    this.avoidDesktopChanged = false;
    this.desktopsExtend = new Queue();
  }

  create(focus = false) {
    this.workspace.createDesktop(this.workspace.desktops.length, "");
    let layout = this.tiles.getDefaultLayouts(this.config.layoutDefault - 1);

    if (this.config.layoutCustom !== undefined) {
      layout = this.config.layoutCustom;
    }

    const desktopCreated =
      this.workspace.desktops[this.workspace.desktops.length - 1];

    this.tiles.setLayout(desktopCreated, layout);

    if (focus === true) {
      this.workspace.currentDesktop = desktopCreated;
    }

    return desktopCreated;
  }

  remove(info) {
    this.timerRemoveDesktop.removeInfo = info;
    this.timerRemoveDesktop.start();
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
        this.create();
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
}
