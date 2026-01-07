import { useTiles } from "./tiles.mjs";

export function useUI(workspace, config, rootUI) {
  const apiTile = useTiles(workspace, config);

  //Paint tiles
  function resetLayout() {
    rootUI.layoutOrdered = [];
    rootUI.layoutOrdered = apiTile.getTilesFromActualDesktop();
  }

  // When a window start move with the cursor, reset ui
  function onUserMoveStart() {
    resetLayout();
  }

  // When a window is moving with the cursor
  function onUserMoveStepped(windowGeometry) {
    rootUI.visible = true;
    const cursor = getPosition(windowGeometry);
    rootUI.tileActived = rootUI.layoutOrdered.findIndex((tile) => {
      const limitX = tile.absoluteGeometry.x + tile.absoluteGeometry.width;
      const limitY = tile.absoluteGeometry.y + tile.absoluteGeometry.height;
      return (
        tile.absoluteGeometry.x <= cursor.x &&
        limitX >= cursor.x &&
        tile.absoluteGeometry.y <= cursor.y &&
        limitY >= cursor.y
      );
    });
  }

  //When the user release the window
  function onUserMoveFinished(windowMoved) {
    if (rootUI.visible === true) {
      rootUI.visible = false;
      const tile = rootUI.layoutOrdered[rootUI.tileActived];
      if (tile !== undefined) {
        tile.manage(windowMoved);
        windowMoved.tilePrevious = tile;
      }
      rootUI.tileActived = -1;
    }
  }

  //Get cursor position or window position
  function getPosition(windowGeometry) {
    if (config.UIWindowCursor === true) {
      return {
        x: (windowGeometry.x + windowGeometry.right) / 2,
        y: windowGeometry.y,
      };
    }

    return { x: workspace.cursorPos.x, y: workspace.cursorPos.y };
  }

  return {
    onUserMoveFinished,
    onUserMoveStepped,
    onUserMoveStart,
    resetLayout,
  };
}
