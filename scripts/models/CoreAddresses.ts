export class CoreAddresses {
  public readonly controller: string;
  public readonly announcer: string;
  public readonly bookkeeper: string;


  constructor(controller: string, announcer: string, bookkeeper: string) {
    this.controller = controller;
    this.announcer = announcer;
    this.bookkeeper = bookkeeper;
  }
}
