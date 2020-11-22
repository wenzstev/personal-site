---
layout: post
title: Adding Authentication - Part 1
author: Steve
---

Before I could go any further into fleshing out the usability of my app, I needed to add authentication. After all, there's no way to create or modify recipes or lists without authentication credentials.

Unfortunately, this process sent me down a bit of a wormhole, as security for apps that have a split front and back end like mine does is quite complicated. My backend is set up to use JSON Web Tokens (JWTs) that are sent by the front end in the header. They have a set expiration date, after which the credentials need to be sent again for a new token. After reading a lot about this and practicing on another project (incidentally, my first experience with Express), I realized that I would need to alter this to a two-token system: a refresh token and an access token. Because only the refresh token is stored (as a cookie), it's a lot more secure than storing the access token in a cookie or (God forbid) storing the access token in local storage. I plan to implement a design similar to how what is described in [this](https://hasura.io/blog/best-practices-of-using-jwt-with-graphql/#silent_refresh) blog post.

But I'm getting ahead of myself. First, I wanted to make sure that I understood how authentication works, and that meant hooking up the system that I already had in place.

### Getting the Token

First, I needed to figure out where to store the token. I thought about storing it in Redux but ultimately it felt more secure to store it simply as a piece of state in my `App.js` component, passing it down as necessary. Doing this would also provide me with an elegant way to determine if a user was logged in, and what to show the user if so: if the `token` state wasn't `null`, show the logged in app. Otherwise, show the logged out app.

{% highlight javascript %}
function App() {
  const [token, setToken] = useState(null)

  return (
    <Router>
      <div className="App">
        {token ? <AuthenticatedApp token={token} /> : <UnauthenticatedApp setToken={setToken} />}
      </div>
    </Router>

  );
}
{% endhighlight %}

The two different `App` components here (`AuthenticatedApp` and `UnauthenticatedApp`) are essentially two different routing implementations. The `AuthenticatedApp` provides routes for the main interface pages, and will also have routes for the recipe and list pages.

{% highlight javascript %}
const AuthenticatedApp = (props) => {
  return (
      <Switch>
        <Route path="/recipes">
          <RecipePage />
        </Route>
        <Route path="/lists">
          <ListPage />
        </Route>
        <Route path="/ingredients">
          <IngredientPage />
        </Route>
        <Route path="/">
          <Redirect to="/recipes"/>
        </Route>
      </Switch>
  )
}
{% endhighlight %}

The  `UnauthenticatedApp` has a login screen and the page to verify a new account (more in this later). It will have other pages for explanation and instructions, but for now everything just redirects back to the login page.

{% highlight javascript %}
const UnauthenticatedApp = (props) => {
  return (
      <Switch>
        <Route path="/login">
          <LoginPage setToken = {props.setToken} />
        </Route>
        <Route path="/verify" component={VerifyPage} />
        <Redirect to="/login"/>
      </Switch>
  )
}
{% endhighlight %}

Notice also that I passed down the `setToken` function onto the login page. This is because that page will be the one doing most of the heavy lifting.

The actual process of getting the token is pretty simple, and most of it has already been implemented. I refactored the `LoginPanel` submit button to use the passed-down `setToken` function.

{% highlight javascript %}
const login = (values, actions) => {
  let headers = new Headers()
  headers.append('Authorization', 'Basic ' + btoa(values.email + ":" + values.password))

  fetch("/users/token",{
    method: 'GET',
    headers: headers,
  })
  .then(response=>{
    console.log(response)
    return response.json()
  })
  .then(json=>props.setToken(json['token']))
}
{% endhighlight %}

This is imperfect; it needs to have a way to catch an incorrect password or an email account that isn't in the system. But at the moment, I'm just trying to get it working.

This system allows the token to be retrieved by the `LoginPanel` component and then stored for the entire app to use. The app then contextually changes from showing the un-logged-in version to the logged-in version. Of course, this is still imperfect; due to the token being stored in state, a single refresh will log the user out. I plan to fix that in Part 2 of this post, but for now I want to move to the second part of this post: creating and validating a new account.

### Validating Emails

Recall that simply creating an account is not enough to be able to create recipes: the backend expects email verification first. During testing, I've generally circumvented this by returning the authorization token myself, but obviously this won't work for the actual app.

In order to implement verification, I first had to create a page on my frontend that would verify. This is the page that is linked to in the verification email; a token is provided in the email, which is then sent to the backend, completing the circle and verifying the email. I kept this page very simple, using the [`qs`](https://github.com/ljharb/qs) library to parse the token from the query string:

{% highlight javascript %}
const VerifyPage = (props) => {
  const [verified, setVerified] = useState(false)
  const token = qs.parse(props.location.search,{ignoreQueryPrefix:true})

  fetch(`/users/verification?token=${token.token}`,{
    method: 'PUT'
  })
  .then(response=>{
    if(response.status===200){
      setVerified(true)
    }
  })

  return (
    <MainTemplatePage noSearchbar>
      <Grid item>
        <Paper>
          <Box m={2}>
            {verified ? <p>Success! Your email account has been verified.</p> : null }
            <Link to="/login">Return to login page</Link>
          </Box>
        </Paper>
      </Grid>
    </MainTemplatePage>
  )
}
{% endhighlight %}

Then, I created a new panel for the `LoginPage`, `RegisteredPanel`. This panel replaces the `RegisterPanel` (confusing names, I know) after the user has submitted a new account to register. When it's mounted, it sends a `fetch` request to the backend containing email and password (passed down from the `props`) and the route to the verify location.

{% highlight javascript %}
const RegisteredPanel = (props) => {
  const sendVerificationEmail = () => {
    let headers = new Headers()
    headers.append('Authorization', 'Basic ' + btoa(props.email + ":" + props.password))

    fetch("/users/verification?url=http://localhost:3000/verify",{
      method: 'GET',
      headers: headers,
    })
    .then(request=>console.log(request))
  }
  sendVerificationEmail()
  return (
    <div>
      <p>
      Success! your account has been created. Please go to your email and click the verification link to validate your account.
      </p>
      <p>
      Click <button onClick={sendVerificationEmail}>here</button> to resend the email.
      </p>
    </div>
  )
}
{% endhighlight %}

Recall from [this]({% post_url 2020-05-14-User-Schema %}) post that the backend takes the route to verify the email as well.

And that's it! People can now register new accounts for the app. They will get an email, which, when clicked on, will take them to a verification page and inform the backend that the user does indeed have access to that account. There's still work to do here, but most of my time this week was spent figuring out the concepts behind security, and I wanted to get something out as a marker of that.

#### Next Steps

* create refresh tokens
* allow users to see their recipes and lists
* begin to implement modifications and additions 
