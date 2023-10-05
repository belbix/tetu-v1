import { Announcer, Bookkeeper, Controller } from '../typechain';

export class CoreContractsWrapper {
  public controller: Controller;
  public bookkeeper: Bookkeeper;
  public announcer: Announcer;


  constructor(controller: Controller, bookkeeper: Bookkeeper, announcer: Announcer) {
    this.controller = controller;
    this.bookkeeper = bookkeeper;
    this.announcer = announcer;
  }
}
