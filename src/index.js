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
     */
    constructor(observedVariables, callback) {
        this._observedVariables = observedVariables;
        this._callback = callback;
        this._targetElement = null;
    }
    /**
     * Attach observer to target element. Callback will be invoked immediately with the current assigned values.
     *
     * @param targetElement target element
     */
    attach(targetElement) {
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
    detach() {
        if (this._targetElement) {
            this._unsetTargetElementStyles(this._targetElement);
            this._targetElement.removeEventListener('transitionstart', this._eventHandler);
            this._targetElement = null;
        }
    }
    /*
     * Observer CSS variables and their iternal identifiers.
     */
    _observedVariables;
    /*
     * User supplied callback that receives CSS variable values.
     */
    _callback;
    /*
     * Event handler that is used to invoke callback.
     */
    _eventHandler = this._handleUpdate.bind(this);
    /*
     * The element that is being observed
     */
    _targetElement;
    /**
     * Attach the styles necessary to track the changes to the given element
     *
     * @param targetElement The element to track
     */
    _setTargetElementStyles(targetElement) {
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
    _unsetTargetElementStyles(targetElement) {
        // @TODO: Don’t remove all, only remove the tracked variables
        targetElement.style.removeProperty('transition');
        targetElement.style.removeProperty('transition-behavior');
    }
    /**
     * Collect CSS variable values and invoke callback.
     */
    _handleUpdate() {
        if (this._targetElement) {
            const computedStyle = getComputedStyle(this._targetElement);
            const variables = {};
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
export default CSSStyleObserver;
