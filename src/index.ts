/**
 * Structure holding CSS computed values. Example:
 *
 * ```json
 * {
 *     "--my-variable": "1.0",
 *     "display": "block"
 * }
 * ```
 */
export type CSSDeclarations = { [key: string]: string };

/**
 * Structure holding detailed CSS property information
 *
 * ```json
 * {
 *   "--my-variable": {
 *     "propertyName": "--my-variable",
 *     "value": "1.0",
 *     "previousValue": "0.5",
 *     "changed": true
 *   },
 *   "display": {
 *     "propertyName": "display",
 *     "value": "flex",
 *     "previousValue": "flex",
 *     "changed": false
 *   }
 * }
 * ```
 */
export interface CSSPropertyInfo {
  propertyName: string;
  value: string;
  previousValue: string;
  changed: boolean;
}

/**
 * Type signature of observer callback.
 *
 * @param values Readonly structure containing observed CSS properties and their values
 */
export type CSSStyleObserverCallback = (
  values: Readonly<CSSDeclarations | { [key: string]: CSSPropertyInfo }>
) => void;

/**
 * Enum for return format options.
 */
export enum ReturnFormat {
  VALUE_ONLY = 'value_only',
  OBJECT = 'object',
}

/**
 * Enum for callback modes
 */
export enum NotificationMode {
  CHANGED_ONLY = 'changed_only',
  ALL = 'all',
}

/**
 * Options for configuring the CSSStyleObserver
 */
export interface CSSStyleObserverOptions {
  notificationMode?: NotificationMode;
  returnFormat?: ReturnFormat;
}

/**
 * Passive observer for CSS properties. Instead of typical polling approach, it uses CSS
 * transitions to detect changes.
 *
 * CSSStyleObserver can be used to build dynamic theming system, detect media etc.
 *
 * Usage:
 * ```javascript
 * const cssStyleObserver = new CSSStyleObserver(['--my-variable'], (variables) => console.log("Value:",variables['--my-variable']));
 * cssStyleObserver.attach(document.body);
 * ```
 */
export class CSSStyleObserver {
  /**
   * Create a new (detached) instance of CSS variable observer.
   *
   * @param observedVariables list of CSS variables to observe
   * @param callback callback that will be invoked every time any of listed CSS variables change
   * @param options configuration options
   */
  constructor(
    observedVariables: string[],
    callback: CSSStyleObserverCallback,
    options: CSSStyleObserverOptions = {}
  ) {
    this._observedVariables = observedVariables;
    this._callback = callback;
    this._targetElement = null;
    this._cachedValues = {};
    this._notificationMode = options.notificationMode ?? NotificationMode.CHANGED_ONLY;
    this._returnFormat = options.returnFormat ?? ReturnFormat.VALUE_ONLY;
  }

  /**
   * Attach observer to target element. Callback will be invoked immediately with the current assigned values.
   *
   * @param targetElement target element
   */
  attach(targetElement: HTMLElement): void {
    if (!this._targetElement) {
      this._targetElement = targetElement;
      this._setTargetElementStyles(this._targetElement);
      this._targetElement.addEventListener('transitionstart', this._eventHandler);
      this._handleUpdate();
    }
  }

  /**
   * Detach observer.
   */
  detach(): void {
    if (this._targetElement) {
      this._unsetTargetElementStyles(this._targetElement);
      this._targetElement.removeEventListener('transitionstart', this._eventHandler);
      this._targetElement = null;
    }
  }

  /*
   * Observer CSS variables and their internal identifiers.
   */
  private _observedVariables: string[];

  /*
   * User supplied callback that receives CSS variable values.
   */
  private _callback: CSSStyleObserverCallback;

  /*
   * Event handler that is used to invoke callback.
   */
  private _eventHandler = this._handleUpdate.bind(this);

  /*
   * The element that is being observed
   */
  private _targetElement: HTMLElement | null;

  /*
   * Cache to store previous values of observed properties
   */
  private _cachedValues: { [key: string]: string };

  /*
   * Mode to determine whether to observe all properties or only the changed ones
   */
  private _notificationMode: NotificationMode;

  /*
   * Format to determine how to return the observed values
   */
  private _returnFormat: ReturnFormat;

  /**
   * Attach the styles necessary to track the changes to the given element
   * 
   * @param targetElement The element to track
   */
  private _setTargetElementStyles(targetElement: HTMLElement): void {
    const cssTransitionValue = this._observedVariables
      .map(value => `${value} 0.001ms step-start`)
      .join(', ');

    // @TODO: Don’t overwrite the existing transition
    targetElement.style.setProperty('transition', cssTransitionValue);
    targetElement.style.setProperty('transition-behavior', 'allow-discrete');
  }

  /**
   * Remove the styles that track the property changes
   * 
   * @param targetElement The element to track
   */
  private _unsetTargetElementStyles(targetElement: HTMLElement): void {
    // @TODO: Don’t remove all, only remove the tracked variables
    targetElement.style.removeProperty('transition');
    targetElement.style.removeProperty('transition-behavior');
  }

  /**
   * Process observed variables and collect changes
   *
   * @param computedStyle The computed style of the target element
   * @param processChange Function to process each changed property
   * @param finalizeChanges Function to finalize and handle collected changes
   */
  private _processChanges(
    computedStyle: CSSStyleDeclaration,
    processChange: (propertyName: string, currentValue: string, previousValue: string, hasChanged: boolean) => void,
    finalizeChanges: () => void
  ) {
      this._observedVariables.forEach((propertyName) => {
        const currentValue = computedStyle.getPropertyValue(propertyName);
        const previousValue = this._cachedValues[propertyName] || '';
        const hasChanged = currentValue !== previousValue;

      if (this._notificationMode === NotificationMode.ALL || hasChanged) {
        processChange(propertyName, currentValue, previousValue, hasChanged);
        this._cachedValues[propertyName] = currentValue;
      }
    });

    finalizeChanges();
  }

  /**
   * Handlers for return formats
   */
  private _returnFormatHandlers: Record<ReturnFormat, (computedStyle: CSSStyleDeclaration) => void> = {
    [ReturnFormat.VALUE_ONLY]: (computedStyle) => {
      const changes: CSSDeclarations = {};

      this._processChanges(computedStyle, (propertyName, currentValue) => {
        changes[propertyName] = currentValue;
      }, () => {
        if (Object.keys(changes).length > 0) {
          this._callback(changes);
        }
      });
    },
    [ReturnFormat.OBJECT]: (computedStyle) => {
      const changes: { [key: string]: CSSPropertyInfo } = {};

      this._processChanges(computedStyle, (propertyName, currentValue, previousValue, hasChanged) => {
        changes[propertyName] = {
          propertyName,
          value: currentValue,
          previousValue,
          changed: hasChanged,
        };
      }, () => {
        if (Object.keys(changes).length > 0) {
          this._callback(changes);
        }
      });
    },
  };

  /**
   * Collect CSS variable values and invoke callback.
   */
  private _handleUpdate(): void {
    if (this._targetElement) {
      const computedStyle = getComputedStyle(this._targetElement);

      // Execute the handler for the current return format, default to ReturnFormat.VALUE_ONLY if not valid
      const handler = this._returnFormatHandlers[this._returnFormat] ?? this._returnFormatHandlers[ReturnFormat.VALUE_ONLY];
      handler(computedStyle);
    }
  }

}

export default CSSStyleObserver;
