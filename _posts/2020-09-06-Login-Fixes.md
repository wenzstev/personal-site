---
layout: post
title: More Users and a Better Login
author: Steve
---

This post is split into two main areas of fixes: governing what to do when a user attempts to access resources that don't belong to them, and creating a more responsive login process.

### User Interaction

So, at some point (and hopefully soon), I would like to add the ability to allow users to add and interact with recipes that they did not add. However, doing so invites a ton of additional complexity into my program that I don't have time to deal with right now, and so I wanted a quick and easy way to seal off those areas to people who aren't logged in. At the same time, I refactored out my 404 Page in order to create a generic information page for when things go wrong.

First, I created a `BasicInfoPage`, which stored the styling that I had originally used for the 404 page.

{% highlight javascript %}
const useStyles = makeStyles({
  root: {
    borderRadius: "15px",
    position: "relative",
    top: "10vh",
    padding: "20px"
  }
})

const BasicInfoPage = (props) => {
  const classes = useStyles()
  return (
    <MainTemplatePage noSearchbar>
      <Paper className={classes.root}>
        {props.children}
      </Paper>
    </MainTemplatePage>
  )
}

export default BasicInfoPage
{% endhighlight %}

This became the basis for all additional informational pages.

Next, I refactored out the "Go Back" and "Go Home" buttons from my 404 page into a new component, `WrongTurnNavOptions`.

{% highlight javascript %}
const WrongTurnNavOptions = (props) => {
  const history = useHistory()
  return (
    <>
      <Box m={2}>
        <Divider />
      </Box>
      <Grid container justifyContent="center" alignItems="center">
        <Grid item xs={6}>
          <ButtonTemplate
            color="primary"
            onClick={()=>history.goBack()}>Go Back</ButtonTemplate>
        </Grid>
        <Grid item xs={6}>
          <ButtonTemplate color="secondary"
            onClick={()=>props.history.push("/")}>
            Go to Homepage</ButtonTemplate>
        </Grid>
      </Grid>
    </>
  )
}

export default withRouter(WrongTurnNavOptions)
{% endhighlight %}

I combined this with the `BasicInfoPage` to create a generic "error" page, `WrongTurnPage.`

{% highlight javascript %}
const WrongTurnPage = (props) => {
  const classes = useStyles()
  const history = useHistory()
  return (
    <BasicInfoPage>
        {props.children}
        <WrongTurnNavOptions />
    </BasicInfoPage>
  )
}
{% endhighlight %}

Finally, I was able to recreate the 404 page using these new components.

{% highlight javascript %}

const NotFoundPage = () => {
  return (
    <WrongTurnPage>
      <Typography variant="h1">
        Hmmm...
      </Typography>
      <Typography>
        Looks like the page you're trying to find doesn't exist! Sorry about that.
      </Typography>
    </WrongTurnPage>
  )
}

export default NotFoundPage
{% endhighlight %}

I then created a new page, `NotYourResource`, which would be displayed whenever a user tried to access a list or recipe that they had not created.

{% highlight javascript %}
const NotYourResource = (props) => {
  return (
    <WrongTurnPage>
      <Typography>
        Sorry, but this {props.resource} doesn't belong to you. In the future, we
        hope to allow use of recipes and lists created by other users, but this
        is not currently supported.
      </Typography>
    </WrongTurnPage>
  )
}

export default NotYourResource
{% endhighlight %}

Doing it this way created a standard look for all of my error pages, which I liked. But I wasn't finished: I still needed the server to actually check if the accessed list or recipe belonged to the user or not. I implemented this in a similar way to how I implemented the 404 page for recipe and lists, just one step later in the process. After recieving the resource, the app checks if the `id` of the user is the same as the `creator_id` of the resource. If not, it displays the `NotYourResource` page instead of the recipe. From the `EditRecipePage` (implementation is identical for lists):

{% highlight javascript %}
const EditRecipePage = () => {
  // ...
  const [hasPermission, setHasPermission] = useState(true)
  // ...

  const getRecipe = async() => {
    // ...
    if (recipe.data.creator_id == user.id){
      setRecipe(recipe.data)
    } else {
      setHasPermission(false)
    }
  }

  // ...

  return (
  <>
    {recipeExists ?
      hasPermission ?
        (
        <MainTemplatePage noSearchbar>
          <EditableTitle type="recipe" hasBackArrow />
          <RecipePanel
            lines={recipe.recipe_lines}
            removeLineFromDOM={removeLineFromDOM}
            changeLine={changeRecipeLine}/>
        </MainTemplatePage>
    ) : <NotYourResource resource="recipe" />
      : <Redirect to="/pagenotfound" />
  }
  </>
)
{% endhighlight %}

This prevents users from accessing resources that aren't theirs, while also indicating that this is a design choice and hopefully will not always be the case.

### More Responsive Login

Next, I made some changes to the login screen, updating some of my older requests to use `async` methods and be much more responsive when errors happen. Previously, if a login failed, the app didn't inform the user of anything; it just sort of sat there blankly. It was time to fix that.

In order to do so, I resurrected some nonfunctional code that I had left in the `LoginPanel` before: a `Snackbar` component that I had been trying to rig up to display error messages. I'm not entirely sure why I scrapped it before, but it appeared to work appropriately for my needs.

First, I moved the component up a level, into the main `LoginPage` component. I did this so I didn't have to remake the Snackbar for my `RegisterPanel` component as well. I created two pieces of state that would govern the snackbar: one to determine the message and one to control if it was open or not. I packaged these together in a single function, `displayAlert`, that I passed down to the child components.

{% highlight javascript %}
const LoginPage = (props) => {
  // ...
  const [errorMessage, setErrorMessage] = useState("")
  const [open, setOpen] = useState(false)

  // ...

  const snackBar = (
    <Snackbar
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left'
      }}
      open={open}
      autoHideDuration={6000}
      onClose={handleClose}>
      <Alert severity="error">{errorMessage}</Alert>
    </Snackbar>
  )

  const displayAlert = (message) => {
    setErrorMessage(message)
    setOpen(true)
  }
{% endhighlight %}

The `Alert` component here is created from the "Alert" function in the "lab" section of Material-UI, and has some small stylings in the same vein as was recommended in the [Snackbar reference](https://material-ui.com/components/snackbars/).

{% highlight javascript %}
const Alert = (props) => <MuiAlert elevation={6} variant="filled" {...props} />
{% endhighlight %}

In the individual panels, I rewrote my AJAX requests using `async` methods and `axios`, and checked the status of the response and any other information provided by the backend to tell the user the appropriate error message. Here's the `login` function, used by the `LoginPanel`.

{% highlight javascript %}
const login = async(values, actions) => {
    try {
      var loginResponse = await axios.get(`/users/refresh-token`,{
        headers: {
          'X-Requested-With': 'XMLHttpRequest', // attempt to disable default authorization prompt, not working
          'Authorization': 'Basic ' + btoa(values.email + ":" + values.password)
        }
      })
    } catch(e) {
      if (e.response.status == 500) {
        props.displayAlert("There appears to be a problem with the server. Please check back later.")
      }
      if(e.response.status==401){
        props.displayAlert("Invalid Username or Password.")
      }
      return
    }
    if (loginResponse.status != 204){
      console.log("error: request returned response of " + loginResponse.status)
      return
    }
    try {
      var tokenResponse = await axios.get(`/users/token`)
    } catch(e) {
      console.log(e)
      return
    }
    dispatch(setToken(tokenResponse.data['token']))
    dispatch(setUser(tokenResponse.data['user']))
    props.setHasToken(true)
  }
{% endhighlight %}

Using the 500 response is still a bit iffy, but at least I've got some responses.

As an aside to this area, I also used my `BasicInfoPanel` to display information regarding validating tokens, like so:

{% highlight javascript %}
// page the user is directed to when they use the validation email

const VerifyPage = (props) => {
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState(false)
  const token = qs.parse(props.location.search,{ignoreQueryPrefix:true})

  const verify = async() => {
    try {
      var verifyResponse = await axios.put(`/users/verification`,{
        params: {
          token: token
        }
      })
    } catch (e) {
      setError(true)
      return
    }
    if (verifyResponse.status == 200) {
      setVerified(true)
    }
  }

  useEffect(()=>{
    verify()
  },[])


  return (
    <BasicInfoPage>
      {verified ?
        <Typography>Success! Your account has been verified. </Typography>
        : error ? <Typography>Hmm, we had a problem verifying your account.</Typography>
        : <Typography>Please wait...</Typography>
      }
    </BasicInfoPage>
  )
}

export default VerifyPage
{% endhighlight %}

And that's it! The login page now displays basic error information (as well as form validations, already completed), and there are temporary stoppers in place to prevent users from accessing resources that aren't theirs.

### Next Steps

* More information in the `UnauthenticatedApp` to explain how the program works

* Some bug fixes

* Documentation 
