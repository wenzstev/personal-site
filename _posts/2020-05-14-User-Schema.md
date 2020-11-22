---
layout: post
title: Creating the User Schema and Endpoints
author: Steve
---

Before we get to today's schemas and endpoints, we need to talk about validation. I spent some time researching API validation and ultimately took most of my inspiration from [this](https://blog.miguelgrinberg.com/post/restful-authentication-with-flask) article by Miguel Grinberg. My passwords are hashed with a `custom_app_context` object, which is done in a class function.

{% highlight python %}
# function to hash password
def hash_password(self, password):
    self.hashed_password = pwd_context.encrypt(password)

# function to verify password
def verify_password(self, password):
    print(self.hashed_password)
    return pwd_context.verify(password, self.hashed_password)
{% endhighlight %}

Additionally, I created methods for creating and authenticating a token, as recommended by the article. This way the user's credentials are not sent back and forth with every API request.

{% highlight python %}
# generate a secure token for authentication
def generate_auth_token(self, expiration=600):
    s = Serializer(current_app.config['SECRET_KEY'], expires_in=expiration)
    return s.dumps({'id': self.id}).decode("utf-8")

# verify a token
@staticmethod
def verify_auth_token(token):
    s = Serializer(current_app.config['SECRET_KEY'])
    try:
        data = s.loads(token)
    except SignatureExpired:
        return None  # valid token, expired
    except BadSignature:
        return None  # invalid token

    user = User.query.get(data['id'])
    return user
{% endhighlight %}

I imported the `flask_httpauth` package and initialized an `HTTPBasicAuth` object in my `__init__.py` folder. Then I created the `verify_password` function.

{% highlight python %}
# verifying password and email
@auth.verify_password
def verify_password(username_or_token, password, needs_valid_email=True):
    print(username_or_token, password)
    # first try to authenticate by token
    user = User.verify_auth_token(username_or_token)
    if not user:
        # try to authenticate with username, password
        user = User.query.filter_by(email=username_or_token).first()
        if not user or not user.verify_password(password):
            return False
        if needs_valid_email and not user.email_validated:
            raise InvalidUsage("Email not validated.", 401)
    g.user = user
    return True
{% endhighlight %}

This function first tries to authenticate by token, and then by username and password if token authentication fails. It's a pretty straight rewrite of Miguel Grinberg's example, with one difference: I added a `needs_valid_email` check to determine if the user had validated their email. This was enabled on default, but I needed an option to disable it for specific instances, which I'll detail later in this post. The `user.email_validated` variable is a boolean that I added to the `User` model.

With the authentication written, it was time to define my schema.

{% highlight python %}
# schema that returns/validates a user
class UserSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = User
        include_fk = True

    # return a user
    @post_load
    def return_user(self, data, ** kwargs):
        existing_user = User.query.filter_by(email=data["email"]).first()
        if existing_user:
            return existing_user
        else:
            return User(** data)
{% endhighlight %}

Again, this schema is extremely simple and relies on the SQLAlchemyAutoSchema class to generate. The only piece I added on was a `post_load` call that checked if the user was in the system, and returned that specific user if so. If not, it reaturned a new user. I queried the users using the `email` attribute, as it is guaranteed to be present (unlike the `id` and also unique).

Additionally, I added a second schema, specifically for the creation of new Users. I chose to do it this way because I wanted to store the logic of hashing the password in the schema, rather than doing so in the actual route. This also allowed me to validate a "password" field to ensure that the user's password was up to security standards before hashing. I used a `post_load` decorator to hash the password and a `validates` decorator to validate the password.

{% highlight python %}
# schema for creating a new user
class CreateUserSchema(ma.Schema):
    email = fields.Str(required=True)
    password = fields.Str(required=True)
    access_level = fields.Int(default=0)

    @post_load
    def return_new_user(self, data, ** kwargs):
        data["hashed_password"] = data.pop("password")  # prevent typeerror when creating User
        new_user = User(** data)
        new_user.hash_password(new_user.hashed_password)
        return new_user

    @validates('password')
    def validate_password(self, password):
        if len(password) < 3:
            raise ValidationError("Password is too short!")
        if len(password) > 20:
            raise ValidationError("Password is too long!")
        if password.isalpha():
            raise ValidationError("Password must contain at least one number and one symbol!")
        if password.isdigit():
            raise ValidationError("Password must contain at least one letter!")
        required_characters = ['!', '@', "#", "$", "%", "^", "&", "* ", "+", "=", "?"]
        if not any(char in password for char in required_characters):
            raise ValidationError(f"Password must contain one of the following characters: {required_characters}")

        return True
{% endhighlight %}

Also note that `access_level` defaults to 0 right now. I'm still working out the best way to structure user levels of access, but tentatively I'm thinking that 2 is an admin (and would only use my specific account), whereas 0 and 1 are either guest accounts or unverified emails. Frankly, I'm not entirely wedded to the three-tiered system, as you'll see later in this post.

### The Endpoints

The endpoints follow REST standards: there is a "GET" for both collections and single users, a "POST" for new users, a "DELETE" for single users, and a "PUT" for changing user information, such as password and email.

The two "GET" routes and the "DELETE" route are the simplest, and are extremely similar to my other resource routes of the same type:

{% highlight python %}
# return all users, or a filtered list
@user.route("/users", methods=["GET"])
@auth.login_required
def get_users():
    all_users = User.query.all()
    return jsonify(users_schema.dump(all_users))


# get a specific user
@user.route("/users/<int:id_>", methods=["GET"])
def get_user(id_):
    cur_user = User.query.get(id_)
    if not cur_user:
        raise NotFoundException("user", id_)
    return jsonify(user_schema.dump(cur_user))


# delete a user
@user.route("/users/<int:id_>", methods=["DELETE"])
def delete_user(id_):
    cur_user = User.query.get(id_)
    if not cur_user:
        raise NotFoundException("user", id_)
    db.session.delete(cur_user)
    db.session.commit()

    return ("", 204)

{% endhighlight %}

My "POST" request for new users makes use of the `CreateUserSchema`, and I catch any `ValidationError`s to send back to the client as a payload.

{% highlight python %}
# post a new user
@user.route("/users", methods=["POST"])
def post_user():
    new_user_json = request.json.get("user")
    if not new_user_json:
        raise InvalidUsage("You must provide a 'user' key to post a new user.")
    try:
        new_user = create_user_schema.load(new_user_json)
        db.session.add(new_user)
        db.session.commit()
        return user_schema.dump(new_user), 201
    except ValidationError as error:
        raise InvalidUsage("Your user data was not formatted correctly.", payload=error.messages)

{% endhighlight %}

My "PUT" request went through several iterations before I realized that I wasn't complying with proper RESTful standards by allowing the user to change only part of the data. I rewrote it so that all of the information about the user must be provided for every "PUT" request. In order to make sure that the new information was valid, I reused my `CreateUserSchema`, which validated the password for me and checked that all information was there. It then returns a new user, and I transfer the data from that user to my old user (to preserve the ID).

{% highlight python %}

# change user information
@user.route("/users/<int:id_>", methods=["PUT"])
@auth.login_required
def change_user_info(id_):
    updated_user = User.query.get(id_)
    if not updated_user:
        raise NotFoundException("user", id_)
    if updated_user.id != g.user.id:
        raise InvalidUsage("You don't have permission to edit accounts that aren't yours.", 401)
    updated_information = request.json.get("user")
    if not updated_information:
        raise InvalidUsage("You must provide information with a 'user' label.")
    try:
        updated_information_user = create_user_schema.load(updated_information)
    except ValidationError as error:
        raise InvalidUsage("Your user data was not formatted correctly.", payload=error.messages)

    updated_user.email = updated_information_user.email
    updated_user.hashed_password = updated_information_user.hashed_password
    updated_user.access_level = updated_information_user.access_level

    try:
        db.session.commit()
    except IntegrityError:
        raise InvalidUsage("That email is already in use.")
    return jsonify(user_schema.dump(updated_user))

{% endhighlight %}

In addition to the basic endpoints, I also implemented three additional ones for verifying email and resources. The first simply generates a token using the method that I created in my Users model.

{% highlight python %}
# get a token for a user
@user.route("/users/token")
@auth.login_required
def get_auth_token():
    token = g.user.generate_auth_token()
    return jsonify({'token': token.decode('ascii')})
{% endhighlight %}

The next one sends an email to the user's provided email account in order to validate it. This one was a bit tricker for several reasons. One, my `auth.login_required` function checked if a user's email account was verified and denied permission if it was not. Therefore, I couldn't use it to validate the user's credentials. I solved this by manually verifying in the function, using my `verify_password` funciton with the `needs_valid_email` setting set to false.

The second issue was the route. In my previous example, the email verification sent a link to the email that, when clicked on, redirected to the app and valided the email of the user in the provided token. However, I couldn't do that this time, because I did not want any user interaction with the backend.

My solution was partial, and won't be complete until I can work on the frontend. Essentially, the `/users/verification` route requires a url argument, in addition to login credentials. This will be the route to the frontend app. The backend sends the email to the user, which directs the user to the frontend page. The frontend then informs the backend that the user is successfully verified.

{% highlight python %}
# email a user with the validation route, provided by the client
def send_validate_email(user, route):
    token = user.generate_auth_token(expiration=2000)
    print("token:", token)
    msg = Message('Verify Your Email', sender='groceryapp@gmail.com', recipients=[user.email])
    msg.body = f'''To verify your email, please visit this link: {route}/{token}.'''
    mail.send(msg)

    return token


# send a verification email
@user.route("/users/verification", methods=["GET"])
def send_verify_email():
    # not using decorator because email is not yet validated
    username = request.authorization["username"]
    password = request.authorization["password"]
    verify_password(username, password, needs_valid_email=False)

    url_to_send = request.args.get("url")
    if not url_to_send:
        raise InvalidUsage("You must provide a client-side url for the verification route")
    token = send_validate_email(g.user, url_to_send)
    return jsonify({"token": token})


# receive verification confirmation
@user.route("/users/verification", methods=["PUT"])
def verify_email():
    print("verifying email")
    token = request.json.get("token")
    user = User.verify_auth_token(token)
    if not user:
        raise InvalidUsage("Unable to get user from token.")
    user.email_validated = True
    db.session.commit()
    return jsonify(user_schema.dump(user))
{% endhighlight %}

It's a bit confusing, but hopefully when I get the frontend set up, I'll be able to revisit this and explain the process in a bit more depth.

And those are my endpoints. Before I was finished with the user implementation, however, there were a few things I needed to change in the other resources. The addition of Users meant that I needed permissions on who got to edit GroceryLists and Recipes.

### New Permissions

The first thing I did was make a slight modification to how my Recipes and GroceryLists were stored. I implemented a `creator_id` field for both of them, which would store the id of the User who created them. Recipes would only be allowed to be modified by their creator, although anyone can use one in a GroceryList. GroceryLists will have the ability to have multiple collaborators, but I still wanted to establish the creator as a separate field. Thus, the association table became one of "editors" rather than "users."

This required some updating of my endpoints. For my Recipes, the changes were minor: I simply added a `login_required` decorator in front of the "DELETE" and "POST" methods. For the "POST" method, the user's id was added to the json data before it was passed into the RecipeSchema. For the "DELETE" method, the user's login information is compared with the creator's ID (to ensure that only the creator can delete a recipe). If they don't match, then a `401` response is given.

{% highlight python %}
@recipe.route("/recipes", methods=["POST"])
@auth.login_required
def post_recipe():
    new_recipe_data = request.json.get("recipe")
    if not new_recipe_data:
        raise InvalidUsage("You must provide a recipe to POST.")
    new_recipe_data["creator_id"] = g.user.id

    new_recipe = recipe_schema.load(request.json.get("recipe"))
    db.session.add(new_recipe)
    db.session.commit()
    return jsonify(recipe_schema.dump(new_recipe)), 201


@recipe.route("/recipes/<int:id_>", methods=["DELETE"])
@auth.login_required
def delete_recipe(id_):
    recipe_to_delete = Recipe.query.get(id_)
    if not recipe_to_delete:
        raise NotFoundException("recipe", id_, "The recipe you are trying to delete does not exist.")

    if recipe_to_delete.creator is not g.user:
        raise InvalidUsage("You are not the creator of this recipe.", 401)

    db.session.delete(recipe_to_delete)
    db.session.commit()

    return ('', 204)
{% endhighlight %}

For my GroceryList endpoints, things were a bit more complicated. The easy change was to the "POST" and "DELETE" methods, and were essentially the same as the new "POST" method for the recipe. For my "PUT" method, however, I needed to check both the creator and the list of editors. I also rewrote the method so that it replaced the entire contents of the list, rather than modifying it as it had before.

{% highlight python %}
@grocerylist.route("/lists/<int:id_>", methods=["PUT"])
@auth.login_required
def add_to_list(id_):
    list_to_modify = GroceryList.query.get(id_)
    if not list_to_modify:
        raise NotFoundException("grocerylist", id_)
    if not (list_to_modify.creator == g.user or g.user in list_to_modify.editors):
        print(g.user, list_to_modify.editors)
        raise InvalidUsage("You don't have permission to modify this list.", 401)

    list_to_modify.clear_grocerylist()

    # add provided recipes
    recipes = request.json.get("recipes")
    if recipes:
        for recipe in recipes:
            if recipe.get("id"):
                list_to_modify.recipes.append(Recipe.query.get(recipe.get("id")))
            else:
                raise InvalidUsage("You must add a recipe by its id.")

    # add provided ingredients
    ingredients = request.json.get("ingredients")
    if ingredients:
        for ingredient in ingredients:
            if ingredient.get("name"):
                add_additional_ingredients(id_, ingredient)
                pass
            else:
                raise InvalidUsage("You must add an ingredient by its name.")

    return jsonify(grocerylist_schema.dump(list_to_modify))
{% endhighlight %}

Finally, I also needed a new route that would allow the creator of the list to modify who could edit it. This route takes a list of users and verifies them before replacing the old list of editors.

{% highlight python %}
# set editors to a GroceryList
@grocerylist.route("/lists/<int:id_>/editors", methods=["PUT"])
@auth.login_required
def add_editors(id_):
    current_list = GroceryList.query.get(id_)
    if not current_list:
        raise NotFoundException("grocerylist", id_)
    if current_list.creator is not g.user:
        raise InvalidUsage("You are not the creator of this Grocery List", 401)
    new_editors = users_schema.load(request.json.get("users"))
    current_list.editors = new_editors
    db.session.commit()

    return jsonify(users_schema.dump(new_editors)), 201
{% endhighlight %}

### Conclusions

And that's it! There are still a few areas that I need to cover, such as adding in filters on my GroceryList, as well as integrating spaCy and my web scrapers. I would also like to do some refactoring, since code is repeated in several places and that's a no-go. But the bulk of my functionality is in place now for the backend, and I'm really excited to begin work on the front. I've been teaching myself React in the mornings since I started this new version, and I'm really excited to bring a ton of new functionality to this thing. 
