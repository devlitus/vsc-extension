import { OfficeLayout, Position, TileType } from '../types';

export function paintTile(layout: OfficeLayout, pos: Position, tileType: TileType): OfficeLayout {
  const newTiles = layout.tiles.map(row => [...row]);
  if (pos.y >= 0 && pos.y < newTiles.length && pos.x >= 0 && pos.x < newTiles[0].length) {
    newTiles[pos.y][pos.x] = tileType;
  }
  return { ...layout, tiles: newTiles };
}

export function eraseTile(layout: OfficeLayout, pos: Position): OfficeLayout {
  return paintTile(layout, pos, 'empty');
}

export function placeFurniture(layout: OfficeLayout, pos: Position, itemId: string, rotation: number): OfficeLayout {
  const newFurniture = [
    ...layout.furniture,
    {
      id: `furn-${Date.now()}`,
      itemId,
      position: { ...pos },
      rotation,
      state: 'default',
    },
  ];
  return { ...layout, furniture: newFurniture };
}

export function removeFurniture(layout: OfficeLayout, furnitureInstanceId: string): OfficeLayout {
  return {
    ...layout,
    furniture: layout.furniture.filter(f => f.id !== furnitureInstanceId),
  };
}

export function moveFurniture(layout: OfficeLayout, instanceId: string, newPos: Position): OfficeLayout {
  return {
    ...layout,
    furniture: layout.furniture.map(f =>
      f.id === instanceId ? { ...f, position: { ...newPos } } : f
    ),
  };
}

export function eyedropper(layout: OfficeLayout, pos: Position): TileType | string {
  if (pos.y >= 0 && pos.y < layout.tiles.length && pos.x >= 0 && pos.x < layout.tiles[0].length) {
    const tile = layout.tiles[pos.y][pos.x];
    if (tile !== 'empty') return tile;
  }
  
  const furniture = layout.furniture.find(f => 
    f.position.x === pos.x && f.position.y === pos.y
  );
  
  return furniture?.itemId ?? 'empty';
}

export function expandGrid(layout: OfficeLayout, direction: 'up' | 'down' | 'left' | 'right'): OfficeLayout {
  let newTiles: TileType[][];
  let newWidth = layout.width;
  let newHeight = layout.height;
  
  switch (direction) {
    case 'up':
      newHeight++;
      newTiles = [new Array(newWidth).fill('empty' as TileType), ...layout.tiles];
      break;
    case 'down':
      newHeight++;
      newTiles = [...layout.tiles, new Array(newWidth).fill('empty' as TileType)];
      break;
    case 'left':
      newWidth++;
      newTiles = layout.tiles.map(row => ['empty' as TileType, ...row]);
      break;
    case 'right':
      newWidth++;
      newTiles = layout.tiles.map(row => [...row, 'empty' as TileType]);
      break;
  }
  
  return { ...layout, width: newWidth, height: newHeight, tiles: newTiles };
}
