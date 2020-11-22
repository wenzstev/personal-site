---
layout: post
title: Adding Authentication - Part 2
author: Steve
---

Well, this post is coming earlier than I thought it would. Turns out it was actually fairly easy to alter my backend code to support a refresh token. What's more, I got to get my hands dirty with a bit of Python again, something I haven't done in a while.

Let's go through the process.

### Creating the Refresh Token Endpoints

Adding support for a refresh token necessitated the creation of some new endpoints. The first is the aptly-named "`/users/reset-token`", which make use of the already existing `generate_auth_token` method. It creates a cookie with a much longer expiration time (14 days) and stores it with the `httpOnly` flag, preventing the client from accessing it.

{% highlight python %}
# get a refresh token for a user
@user.route("/users/refresh-token")
@auth.login_required
def get_refresh_token():
    refresh_token = g.user.generate_auth_token(expiration=1209600)  # 14 days
    response = make_response('', 204)
    response.set_cookie('refresh_token', refresh_token, httponly=True)
    return response
{% endhighlight %}

Next, I modified the `/users/token` endpoint to instead check the cookies for the refresh token. It then uses the token to verify the user and provide the actual access token. I shortened the access token to just five minutes; after that, the client will need to request a new one.

{% highlight python %}
# get a token for a user
@user.route("/users/token")
def get_auth_token():
    refresh_token = request.cookies.get('refresh_token')
    print(refresh_token)
    if not refresh_token:
        raise InvalidUsage("No refresh token", 404)
    user = User.verify_auth_token(refresh_token)
    access_token = user.generate_auth_token(expiration=300)
    return jsonify({'token': access_token})
{% endhighlight %}

Finally, I created a new route to log out, which in this case essentially removes the refresh token. Because there isn't an accepted way to delete a cookie on the server side (see [this](https://stackoverflow.com/questions/14386304/flask-how-to-remove-cookies) post), I simply set the cookie to a blank value and have it instantly expire.

{% highlight python %}
# log out user by deleting httpOnly refresh cookie
@user.route('/users/logout')
def logout_user():
    response = make_response('', 204)
    response.set_cookie('refresh_token', '', expires=0)
    return response
{% endhighlight %}

And that's all the Python work I needed to do.

### Handling the Refresh Token on the Client Side

Next, I needed a way to continually get new refresh tokens, which meant I needed a timed interval. Because I wanted the entire app to hold the token and to attempt to get a refresh token, I decided to add the logic for this part in the main `App.js` file.

First, I created a method, `getToken`, which would sent a `fetch` request to the "`/users/token`" endpoint. Because the refresh token would already exist as a cookie, I didn't need to do anything special to send it. I just waited for the server's response. If it returns 200, all is well. If it returns 404, then there isn't a refresh token and we'll need to direct the user to the login page.

{% highlight javascript %}
const getToken = () => {
  fetch('/users/token')
  .then(response=>{
    if (response.status === 200){
      return response.json()
    } else if (response.status === 404){
      throw new Error('No refresh token.')
    } else {
      throw new Error('Something went wrong.')
    }
  })
  .then(json=>{
    setToken(json['token'])
    setHasToken(true)
  })
  .catch(error=>console.log(error))
}
{% endhighlight %}

I also created a new piece of state, `hasToken`, which was set as `true` if there was a token and `false` if not. I did this rather than just check if `token` was `null` because I needed to use a `useEffect` statement, and I only wanted it to fire once (when we got the first token) rather than every time a new token was retrieved.

{% highlight javascript %}
useEffect(()=>{
  getToken()
  if(hasToken === true){
    console.log('setting interval')
    setInterval(()=>{
      console.log('getting new token')
      getToken()
    }, 240000)
  }
}, [hasToken])
{% endhighlight %}

Thus, every four minutes the server requests a new token. I made the interval slightly shorter than the actual amount of time the token has to give the system some buffer time. May not be strictly necessary, but I prefer it that way.

The best part about this system is that I don't have to do anything else to tell React that a user is logged in; the conditional rendering on the `token` variable takes care of that for me. All that's left is to link up the "`/users/logout`" endpoint with the front end.

Unfortunately, doing so required quite a bit of passing down props. This is the first time that I'm really feeling the lack of Redux, as it would be much better to have the token stored there than at the top level of my app. As is, I had to pass the `setToken` function down five or six levels to get it to the "Log Out" button in my `NavMenu` component. Once there, however, the function was pretty simple: I send a `fetch` request to "`/users/logout`," which deletes the cookie. Once I confirm that the cookie was deleted (204 response), I use the `setToken` function to return the token to "null." This resets the app and effectively logs the user out.

{% highlight javascript %}
const logout = () => {
  fetch('/users/logout')
  .then(response=>{
    if (response.status === 204){
      props.setToken(null)
    }
  })
  .catch(err=>console.log(err))
}
{% endhighlight %}

And that's it! The app now stays logged in through a refresh. Granted, the user will need to log back in properly in two weeks time, but that is less of an issue, and I can always request a new refresh token sometime down the line.

### Next Steps
- display lists, recipes, and ingredients
- implement recipe page
- search functions 
