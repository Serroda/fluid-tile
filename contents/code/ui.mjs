import { useTiles } from "./tiles.mjs";

export function useUI(workspace, config, rootUI) {
  const apiTile = useTiles(workspace, config);
  let windowGeometryOnMove = {};

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
    if (
      windowGeometryOnMove.width === undefined &&
      windowGeometryOnMove.height === undefined
    ) {
      windowGeometryOnMove = {
        width: windowGeometry.width,
        height: windowGeometry.height,
      };
    }

    if (
      windowGeometryOnMove.width !== windowGeometry.width &&
      windowGeometryOnMove.height !== windowGeometry.height
    ) {
      return;
    }

    rootUI.visible = true;

    const cursor = workspace.cursorPos;
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
      rootUI.layoutOrdered[rootUI.tileActived]?.manage(windowMoved);
      windowGeometryOnMove = {};
      rootUI.tileActived = -1;
    }
  }

  return {
    onUserMoveFinished,
    onUserMoveStepped,
    onUserMoveStart,
    resetLayout,
  };
}
