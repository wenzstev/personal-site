---
layout: post
title: Creating the Functionality for the Calculator
author: Steve
---

In the last blog post, I explained how I created the layout for my practice calculator app. This time around, I'm going to go through the process that I used to make it work.

### Adding Redux
To be clear: Redux is not strictly necessary for this example, as I probably could have gotten away with passing props up and down and keeping the state in a single lifted component. But I wanted the opportunity to practice with it, and this seemed like a good way to better familiarize myself with its features.

When working with Redux, the first thing I did was consider what would need to be held in state. Because I wanted a simple calculator that could perform the four basic functions and a few extras, I figured I could keep the state simple: I would need to store both numbers and the function that was being performed on them.

To that end, I created two reducers: a `numReducer` which stored the first and second numbers, and a `funcReducer` which stored the current function.

{% highlight javascript %}
const combinedNumReducer = (
  state = {
    'FIRST': 0,
    'SECOND': 0
  },
  action) => {
    switch(action.type) {
      case 'SETNUM':
        return { ...state, [action.payload.num]: action.payload.value}
      default:
        return state
    }
}

const funcReducer = (state = null, action) => {
  switch(action.type){
    case "SETFUNC":
      console.log("changing to " + action.payload)
      return action.payload
    default:
      return state
  }
}
{% endhighlight %}

I then combined them using Redux's `combineReducers` function:

{% highlight javascript %}
import {combineReducers} from "redux"

const rootReducer = combineReducers({
  nums: combinedNumReducer,
  func: funcReducer,
})

export default rootReducer
{% endhighlight %}

There are additional reducers I needed to add, but I'll cover them as they come up.

# Number Pad Functions

Next, I needed to add the most basic element of the calculator: the number buttons. When a number button is pressed, that amount is added onto the end of the number currently displayed on the calculator. I implemented this by creating a Redux action, `SETNUMKEYPAD`, which told the reducer that a digit was going to be appended to the end of the number.

{% highlight javascript %}
export const setNumKeypad = (num, value) => {
  return {
    type: "SETNUMKEYPAD",
    payload: {
      num: num,
      value: value
    }
  }
}
{% endhighlight %}

Pretty much all of my actions follow this same formula. The actual logic happens in the reducer.

{% highlight javascript %}
case 'SETNUMKEYPAD':
        let newVal = state[action.payload.num] * 10 + action.payload.value
        return { ...state, [action.payload.num]: newVal}
{% endhighlight %}

By multiplying the existing number by 10 and adding the new digit, we create a system where the number is built from right to left, just like a calculator.

The dispatch is then called in the `Buttons.js` file, where `NumButton` is given a `handleClick` functiont hat calls `setNumKeypad`.

{% highlight javascript %}
export const NumButton = (props) => {
  const dispatch = useDispatch()


  const handleClick = (e) =>{
      dispatch(setNumKeypad(props.number))
  }

  return (
    <BaseButton
      label={props.number}
      width={props.width}
      clickHandler={handleClick}
      width={props.width}
      />
  )
}
{% endhighlight %}

However, we quickly run into a problem: the calculator is storing two numbers, but how do we tell it which number to edit? I solved this by adding a new piece of state to Redux: a `display` value that determined which of the two numbers the display was showing at any given time.

{% highlight javascript %}
const displayReducer = (state="FIRST", action) =>{
  switch (action.type){
    case "SETDISPLAY":
      return action.payload
    default:
      return state
  }
}
{% endhighlight %}

From there, I created a `DisplayController` class which served as the "smart" component to the "dumb" `Display` component. This component simply shows which of the two `nums` values `display` is calling for at that time.

{% highlight javascript %}
const DisplayController = (props) =>{
  const nums = useSelector(state => state.nums)
  const display = useSelector(state => state.display)

  return(
    <Display display={nums[display]} />
  )
}

export default DisplayController
{% endhighlight %}

Because `display` uses the same strings ("FIRST" and "SECOND") as the names of the two nums in the `nums` piece of state, it's easy to pass the value of `display` to the `setNumKeypad` function, ensuring that only the number that is currently on the screen is changed.

{% highlight javascript %}
// In NumButton

var display = useSelector(state => state.display)

// ...

dispatch(setNumKeypad(display, props.number))

{% endhighlight %}

Thus, pressing on the buttons allows for the number displayed to be altered, but not the other number saved in the system.

### Adding the Four Functions

Now that we can set numbers, it's time to implement the feature that makes a calculator a calculator: the ability to calculate things.

This version has four primary functions: addition, subtraction, multiplication, and division. The current function being used is saved in the `func` piece of state, and is stored as that function's symbol ("+", "-", "×", and "÷").

The actual calculation process is a simple `switch` statement, evaluating the two numbers and changing the first number into the solution. This is done in order to support chaining functions (e.g., adding then subtracting) or repeating the same function multiple times.

{% highlight javascript %}
const calculateNewValues = () => {
  switch(func){
    case "+":
      dispatch(setNum("FIRST", firstNum + secondNum))
      break
    case "-":
      dispatch(setNum("FIRST", firstNum - secondNum))
      break
    case "×":
      dispatch(setNum("FIRST", firstNum * secondNum))
      break
    case "÷":
      dispatch(setNum("FIRST", firstNum / secondNum))
      break
  }
}
{% endhighlight %}

The equals button then calculates those values, and also sets a new piece of state, `setClearOnNext`, to `true`. This value determines if the calculator is primed to accept a new set of values for a new calculation; without it, subsequent entries on the keypad would alter the result, rather than starting a new number.

{% highlight javascript %}
const evaluate = () =>{
  calculateNewValues()
  dispatch(setDisplay("FIRST"))
  dispatch(setClearOnNext(true))
}
{% endhighlight %}

I also added a little more logic to the act of actually pressing the function buttons. If the "clearOnNext" variable is true, then it is set to false and new values aren't calculated (since we are preparing to perform a new operation). The second number is also preemptively cleared, although the display is not set to show it.

{% highlight javascript %}
const setFuncValue = (val) => {
  if (!clearOnNext){
    calculateNewValues()
  } else {
    dispatch(setClearOnNext(false))
  }
  dispatch(setFunc(val))
  dispatch(setNum("SECOND", 0))
  dispatch(setDisplay("FIRST"))
}
{% endhighlight %}

The responsibility of actually changing the display value falls on the number buttons, since I don't want a new value to be shown until it's absolutely necessary. Additionally, I have the button check if the `clearOnNext` value is true; if so, they clear all values from the calculator and reset them before entering the new value.

{% highlight JavaScript %}
const handleClick = (e) =>{
  if (clearOnNext){
    dispatch(clearAll())
    func = null
  }
  if (func !== null){
    dispatch(setDisplay("SECOND"))
    display = "SECOND"
  }
  dispatch(setNumKeypad(display, props.number))

}
{% endhighlight %}

### Additional Functions

With the four main functions working, it's time to turn to the other buttons on the calculator. Most of these are fairly straightforward and did not require extensive additions.

#### Negating Values

For the "+/-" button, I created a new action, `REVERSESIGN` and returned the existing value multiplied by `-1`:

{% highlight javascript %}
case 'REVERSESIGN':
        return {...state, [action.payload.num]: (state[action.payload.num] * -1)}
{% endhighlight %}

#### Decimals

Adding decimals was a bit trickier, becuase the calculator needed to understand that, once the decimal button was pressed, subsequent number buttons pressed needed to be added to the number in a different way.

I solved this by introducing an additional element of state: `decimalPlace`, which counts the number of decimal places in the current number. If this value is zero, then the program functions normally. It is incremented when the "." button is pressed and then on every number button press after. The value is then used to calculate the addition of a new value after the decimal, by multiplying the new digit by 10 raised to the power of the value. The `handleClick` function in `Buttons.js` was thus rewritten as follows:

{% highlight javascript %}
const handleClick = (e) =>{
  if (clearOnNext){
    dispatch(clearAll())
    func = null
  }
  if (func !== null){
    dispatch(setDisplay("SECOND"))
    display = "SECOND"
  }
  if (decimalPlace > 0){
    dispatch(setNumKeypadDecimal(display, props.number * (.1**decimalPlace)))
    dispatch(incrementDecimal())
  } else {
    dispatch(setNumKeypad(display, props.number))
  }
}
{% endhighlight %}

The `decimalPlace` value is reset whenever the display changes.

#### Clearing Everything

Adding functionality to the `AC` button was extremely simple, as I had already written an action that reset the calculator (for use after the "=" button was pressed). Most of my reducers have a case to listen for this action, and they reset accordingly.

{% highlight javascript %}
<FuncButton
        label="AC"
        func={()=>dispatch(clearAll())}
        color={props.color}/>
{% endhighlight %}

#### Percent Button
Finally, I added functionality to the "%" button. This button is used to calculate the percent of the first number entered; as such it has a few caveats. If pressed when still entering the first number, it returns the value to 0. If pressed after entering the second number, however, it considers the second number to be a percentage and returns the percent value of the *first* number.

{% highlight javascript %}
const calculatePercent = () => {
  if (display === "FIRST"){
    dispatch(setNum(display, 0)) // percent doesn't work on first number
  } else {
    const percentNum = firstNum * secondNum * .01
    dispatch(setNum(display, percentNum))
  }
}
{% endhighlight %}

Note that this does not calculate anything else; it does not replace one of the four functions, for example. This makes it possible to perform actions such as subtracting or adding a certain percent of a number.

### Conclusions

This took longer than I meant it to, mostly due to a lot of things in my personal life going haywire all at once. I'm hoping not to take this long for my next blog post. I have another small React project in the works, and after that I'm fairly confident that I'm ready to tackle the frontend of my Grocery App. I've been talking with my brother to do some markups of how it's going to look and I'm pretty excited, so stay tuned!
