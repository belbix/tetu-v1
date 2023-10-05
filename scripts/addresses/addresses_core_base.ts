import { CoreAddresses } from '../models/CoreAddresses';

export class BaseCoreAddresses {

  public static ADDRESSES = new CoreAddresses(
    '0xfAdBf2e8EF41A3f3cc1AbE8a443A975246b67eEf', // controller
    '0x91be44031612b11794EFbdE1e36379A541cec270', // announcer
    '0xb5321C107C6E3d1C9f8DFfD59F4999a0C9C2bd72', // bookkeeper
  );

}
