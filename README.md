# gamepad-rxjs

A class to use the Gamepad API with RxJs Observables

Polls the Gamepad state every 15ms to emit button presses/releases or joystick movements.

## Install

`$ npm install gamepad-rxjs`;

## Usage

```js
import {
  GamepadObservables,
  ButtonEvent,
  JoystickDirectionEvent,
} from 'gamepad-rxjs';
import { merge, map } from 'rxjs';

const player1 = new GamepadObservables(0);
const player2 = new GamepadObservables(1);

// emits only when the button's state changes
// refer to the Gamepad API documentation for the button mappings
merge(player1.buttonPressed$(9), player1.buttonReleased$(9)).subscribe(
  ({ current }: ButtonEvent) => {
    console.log(
      `Player 1 just ${
        current.pressed ? 'pressed' : 'released'
      } the start button!`
    );
  }
);

// every observable emits both the previous and current button states
// this one provides the joystick's angle and pressure (distance from the center,
// a decimal number from 0 to 1) instead of its x and y coordinates
player2
  .joystickDirection$(0)
  .subscribe(({ previous, current }: JoystickDirectionEvent) => {
    console.log(
      `Player 2 just moved the left joystick from an angle of ${previous.angle} degrees to an angle of ${current.angle} degrees.`
    );
  });

// since all other observables are event based and will emit only once a button is pressed or once
// a joystick angle has changed, you can use this observable which polls the Gamepad's state every 15ms to
// obtain the gamepad's current state
player1.gamepadEvent$
  .pipe(throttle(() => interval(1000)))
  .subscribe((gamepad: Gamepad) => {
    console.log(`This is a snapshot of Player 1's gamepad state: `, gamepad);
  });
```
