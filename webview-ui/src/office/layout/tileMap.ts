import { TileType } from '../types';

export class TileMap {
  private data: TileType[][] = [];
  private _width = 0;
  private _height = 0;

  constructor(width: number, height: number) {
    this._width = width;
    this._height = height;
    this.clear();
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get(x: number, y: number): TileType {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
      return 'empty';
    }
    return this.data[y]?.[x] ?? 'empty';
  }

  set(x: number, y: number, type: TileType): void {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
      return;
    }
    if (!this.data[y]) {
      this.data[y] = [];
    }
    this.data[y][x] = type;
  }

  clear(): void {
    this.data = [];
    for (let y = 0; y < this._height; y++) {
      this.data[y] = [];
      for (let x = 0; x < this._width; x++) {
        this.data[y][x] = 'empty';
      }
    }
  }

  resize(newW: number, newH: number): void {
    const oldData = this.data;
    const oldW = this._width;
    const oldH = this._height;
    
    this._width = newW;
    this._height = newH;
    this.clear();
    
    for (let y = 0; y < Math.min(oldH, newH); y++) {
      for (let x = 0; x < Math.min(oldW, newW); x++) {
        this.data[y][x] = oldData[y]?.[x] ?? 'empty';
      }
    }
  }

  toArray(): TileType[][] {
    return this.data.map(row => [...row]);
  }

  static fromArray(data: TileType[][]): TileMap {
    const height = data.length;
    const width = data[0]?.length ?? 0;
    const map = new TileMap(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        map.set(x, y, data[y]?.[x] ?? 'empty');
      }
    }
    return map;
  }
}
