---
layout: post
title: Additional Cleanup for Release
author: Steve
---

The last few days have just been another grab bag of small fixes and cleanup as I prepare for my first release. As with last time, I just want to move through all of them one by one and briefly touch on them before I get back to work.

### New Pages

Previously, the way that the app authenticated meant that every refresh automatically redirected to the home page (either the recipe or list form). I did this for convenience's sake, but it ultimately meant that it was essentially impossible to stay on a page after refresh. Worse, it was also impossible to go directly to any route, since the authentication wiped any url that was entered. Obviously, this needed to be changed.

I solved this by creating a "landing page" that was essentially a blank template. I then created a new piece of state in the main app file, called `wait`, that essentially determined if the app was still waiting for the promise of a token to resolve. While it was waiting, it displayed the landing page (typically only for a fraction of a second), rather than either the `Authenticated` or `Unauthenticated` versions of the app. This prevented the `UnauthenticatedApp` from wiping the route (since it redirects everything to the login page).

{% highlight javascript %}
const getToken = async() => {
  try {
    var tokenResponse = await axios.get(`/users/token`)
  }
  catch(e) {
    // TODO: inform the user of the error
    console.log(e)
    setWait(false)
    return
  }
  const {data} = tokenResponse
  dispatch(setUser(data['user']))
  dispatch(setToken(data['token']))
  setHasToken(true)
  setWait(false)
  axios.defaults.headers['Authorization'] = 'Basic ' + btoa(data['token']+':')
}

// ...

return (
  <Router>
    <div className="App">
      {wait ? <LandingPage />
      : token ? <AuthenticatedApp /> : <UnauthenticatedApp />}
    </div>
  </Router>

);
{% endhighlight %}

Something that I've realized for a while now but haven't really wanted to deal with is the fact that using Axios essentially makes my use of Redux redundant (since I no longer need to store the login credentials in global store). So at some point I'm probably going to need to take that out. But that's a post release change, I think.

As a side effect of this change, it was now again possible for a user to access routes that didn't exist, which meant that I needed a 404 page. I whipped something up fairly quickly, with options to return to the main page or to go back to where ever they had come from.

{% highlight javascript %}
const NotFoundPage = (props) => {
  const classes = useStyles()
  const history = useHistory()
  return (
    <MainTemplatePage noSearchbar>
      <Paper className={classes.root}>
          <Typography variant="h1">
            Hmmm...
          </Typography>
          <Typography>
            Looks like the page you're trying to find doesn't exist! Sorry about that.
          </Typography>
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
                Go to Homepage
                </ButtonTemplate>
            </Grid>
          </Grid>
      </Paper>
    </MainTemplatePage>
  )
}

export default withRouter(NotFoundPage)

{% endhighlight %}

![alt text](/assets/img/posts/grocery-app/cleanup/not-found.png)

I then added a new `Route` at the end of my React Router `Switch` in `AuthenticatedApp` that would direct to the page if there was no matching router for elsewhere.

{% highlight javascript %}
// other routes before here

<Route path="/login">
  <Redirect to="/recipes" />
</Route>
<Route path="/" exact>
  <Redirect to="/recipes" />
</Route>
<Route component={NotFoundPage} />

{% endhighlight %}

I also added redirects from the `ListInfoPage` and the `EditRecipePage` (should probably change those names to have a better whole naming style), because they just displayed a blank resource template when trying to access a list or recipe that did not exist. Because they're essentially the same, I'll show the one for the `EditRecipePage` as a stand-in for both.


{% highlight javascript %}
const EditRecipePage = () => {
  const [recipe, setRecipe] = useState({})
  const [recipeExists, setRecipeExists] = useState(true)
  const token = useSelector(store=>store.token)
  const {resourceId} = useParams()

  const getRecipe = async() => {
    try {
      var recipe = await axios.get(`/recipes/${resourceId}`)
    } catch (e) {
      if (e.response.status == 404){
        setRecipeExists(false)
        return
      } else {
        console.log(e)
      }
    }
    setRecipe(recipe.data)
  }

  // ...

  return (
    <MainTemplatePage noSearchbar>
      {recipeExists ? (
        <>
          <EditableTitle type="recipe" hasBackArrow />
          <RecipePanel
            lines={recipe.recipe_lines}
            removeLineFromDOM={removeLineFromDOM}
            changeLine={changeRecipeLine}/>
        </>
    ) : <Redirect to="/pagenotfound" />}
    </MainTemplatePage>
  )

{% endhighlight %}

This check operates off a similar principle to the landing page used above, except in this case the program assumes the resource exists first. If the check returns a 404, then it redirects to the general 404 page.

As an aside, I'm continuing to work more with `async` actions and I'm starting to understand why people prefer them to promise chains. Hopefully I'm using them right.

### New Form Components

This is just a small thing that I finally got around to fixing. I had been using the `TextInput` Material-UI form for most of my input components, and modifying it as necessary to suit my needs. Unfortunately, this was not particularly successful, as `TextInput` was a bit too opinionated for what I wanted. I switched to the more low-level `Input` component and had much better results.

{% highlight javascript %}
const useStyles = makeStyles({
  root: {
    "& input": {
      backgroundColor: "#B3B3B3",
      borderRadius: 15,
      padding: "10px 15px"
    },
  },
  error: {
    color: "red",
    textAlign: "left"
  }
})

export const FormikTextField = ({label, ...props}) => {
  const [field, meta] = useField(props)
  const classes = useStyles()
  return(
    <Box my={2} className={classes.root}>
      <Input
        label={label}
        variant="outlined"
        placeholder={label}
        disableUnderline
        fullWidth
        {...field}
        {...props}
        {...meta.touched && meta.error ?
          ({error: true})
          : null}
      />
    {meta.touched && meta.error ?
    <div className={classes.error}>{meta.error}</div> : null}
    </Box>
  )
{% endhighlight %}

Most of what changed here are things that have been taken out (such as the extended modification of fieldsets and other sub components in the `TextInput` component). I did have to add a new div for errors, since `Input` doesn't handle them as well. But it's a minor change. Overall, this makes the inputs on my login page and the two modals much more in keeping with the basic look I'm going for.

![alt text](/assets/img/posts/grocery-app/cleanup/new-login.png)

It's not a huge change, but the previous customizations looked unprofessional to me, and I'm glad to have changed them.

### Next Steps

As is often the case with such things, I unfortunately uncovered some bugs and realized additional things that need to be worked on before I feel comfortable submitting this to release. Increasingly, I'm having to choose what I work on and what I don't, because I'm trying to stick with a set deadline for first release of this thing. I know myself well enough that if I don't, I'll just keep tinkering with it forever and it'll never get done.

That said, there are a few areas that I still need to look into, including:

* Handling access to recipes and lists that the accessor didn't create,
* Creating a title page and other work on the unauthenticated side of things, so that people know what this thing is.
* Just... a lot more documentation in general.

All this, and more, when we return. 
