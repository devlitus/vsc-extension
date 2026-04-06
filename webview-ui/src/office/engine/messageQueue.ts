export class MessageQueue<T> {
  private buffer: (T | null)[] = [];
  private head = 0;
  private tail = 0;
  private capacity = 1000;

  constructor(initialCapacity = 1000) {
    this.capacity = initialCapacity;
    this.buffer = new Array(initialCapacity);
  }

  enqueue(item: T): boolean {
    const nextTail = (this.tail + 1) % this.capacity;
    if (nextTail === this.head) {
      // Queue is full, expand
      this.expand();
    }
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    return true;
  }

  dequeue(): T | undefined {
    if (this.head === this.tail) {
      return undefined; // Empty
    }
    const item = this.buffer[this.head];
    this.buffer[this.head] = null; // Help GC
    this.head = (this.head + 1) % this.capacity;
    return item ?? undefined;
  }

  peek(): T | undefined {
    if (this.head === this.tail) {
      return undefined;
    }
    const item = this.buffer[this.head];
    return item ?? undefined;
  }

  size(): number {
    return (this.tail - this.head + this.capacity) % this.capacity;
  }

  isEmpty(): boolean {
    return this.head === this.tail;
  }

  private expand(): void {
    const newCapacity = this.capacity * 2;
    const newBuffer = new Array(newCapacity);
    for (let i = 0; i < this.size(); i++) {
      newBuffer[i] = this.buffer[(this.head + i) % this.capacity];
    }
    this.buffer = newBuffer;
    this.head = 0;
    this.tail = this.size();
    this.capacity = newCapacity;
  }

  clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.tail = 0;
  }
}
