/**
 * Structure holding CSS variable values. Example:
 *
 * ```json
 * {
 *     "--my-variable": "1.0",
 *     "--my-other-variable": "2.0"
 * }
 * ```
 */
export type CssVariables = { [key: string]: string };

/**
 * Type signature of observer callback.
 *
 * @param values Readonly structure containing observed CSS variables and their values.
 */
export type CssVariableObserverCallback = (
  values: Readonly<CssVariables>
) => void;

/**
 * Passive observer for numeric CSS variables. Instead of typical polling approach, it uses CSS
 * transitions to detect changes.
 *
 * CSSVariableObserver can be used to build dynamic theming system, detect media etc.
 *
 * Usage:
 * ```javascript
 * const cssVariableObserver = new CSSVariableObserver(['--my-variable'], (variables) => console.log("Value:",variables['--my-variable']));
 * cssVariableObserver.attach(document.body);
 * ```
 *
 * Note: Only unitless numeric values are supported. If any of observed variables have non-numeric value,
 * the callback won't be invoked. The good news is: once the bad value is fixed, the observer will start
 * to work again.
 */
export class CSSVariableObserver {
  /**
   * Create a new (detached) instance of CSS variable observer.
   *
   * @param observedVariables list of CSS variables to observe
   * @param callback callback that will be invoked every time any of listed CSS variables change
   */
  constructor(
    observedVariables: string[],
    callback: CssVariableObserverCallback
  ) {
    this._observedVariables = observedVariables;
    this._callback = callback;
    this._sensor = this._createSensor();
  }

  /**
   * Attach observer to target element. Values of CSS variables will be scoped to this element.
   *
   * Callback will be invoked immediately with the current assigne values.
   *
   * @param targetElement target element
   */
  attach(targetElement: HTMLElement): void {
    if (!this._attached) {
      this._sensor.addEventListener('transitionstart', this._eventHandler);
      targetElement.appendChild(this._sensor);
      this._attached = true;

      this._handleUpdate();
    }
  }

  /**
   * Detach observer.
   */
  detach(): void {
    if (this._attached) {
      this._sensor.removeEventListener('transitionstart', this._eventHandler);
      if (this._sensor.parentElement) {
        this._sensor.parentElement.removeChild(this._sensor);
      }
      this._attached = false;
    }
  }

  /*
   * Actual element that senses when values of CSS variables are changed.
   */
  private _sensor: HTMLElement;

  /*
   * Observer CSS variables and their iternal identifiers.
   */
  private _observedVariables: string[];

  /*
   * User supplied callback that receives CSS variable values.
   */
  private _callback: CssVariableObserverCallback;

  /*
   * Event handler that is used to invoke callback.
   */
  private _eventHandler = this._handleUpdate.bind(this);

  /*
   * Observer state
   */
  private _attached = false;

  /*
   * Setup observer sensor.
   *
   * In order to detect changes, `font-variation-settings` property is used. This property accepts
   * list of variation identifiers and their numeric values, which allows to observe any number of
   * CSS variables.
   */
  private _createSensor(): HTMLElement {
    const sensor = document.createElement('div');
    const cssTransitionValue = this._observedVariables
      .map(value => `${value} 0.001ms step-start`)
      .join(', ');

    sensor.style.cssText =
      'position: absolute; ' +
      'width: 0; ' +
      'height: 0; ' +
      'overflow: hidden; ' +
      'z-index: -1; ' +
      'visibility: hidden; ' +
      'transition: ' + cssTransitionValue + ';' +
      'transition-behavior: allow-discrete; '
    return sensor;
  }

  /*
   * Collect CSS variable values and invoke callback.
   */
  private _handleUpdate(): void {
    if (this._attached) {
      const computedStyle = getComputedStyle(this._sensor);

      const variables: CssVariables = {};

      this._observedVariables
        .forEach(value => {
          variables[value] = computedStyle.getPropertyValue(value);
        });

      // Do not invoke callback if no variables are defined
      if (Object.keys(variables).length > 0) {
        this._callback(variables);
      }
    }
  }
}

export default CSSVariableObserver;
