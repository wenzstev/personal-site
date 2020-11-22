---
layout: post
title: Rewriting PUT Requests with Exposed Association Endpoints
author: Steve
---

This is a bit of an unexpected post, in that it grew out of a need to solve a somewhat different problem. I had completed by refactoring for the "GET" and "POST" endpoints, and was trying to do the same for my "PUT" requests. The problem was that the various attributes that needed to be changed for different "PUT" requests were significantly different from each other, such that trying to write a single function to work with all of them began to feel unnecessary and maybe even counterproductive.

But in the course of doing that work, I had to confront a different, but related problem: there was not a particularly robust or easy way to modify the associations between Recipes and GroceryLists and between Users and GroceryLists. Up to this point, I had been submitting the recipe/ingredient/user ids to the GroceryList PUT request, either as single ids or as the full schematic representation of the resource. This worked, but was clunky and often turned up confusing errors. The program often attempted to create new versions of already existing resources, and then threw `IntegrityError`s when it couldn't successfully insert these objects into the database. I had gotten around that previously by expanding my schemas and adding checks, but as my program became more complicated and the checks required increasing detail and special cases, the whole thing just began to feel a bit janky.

Worse, I suspected that this wasn't the proper way to model associations in a RESTful API, as they didn't really follow the database and it felt like a significant amount of the flexibility that I had worked to incorporate was being wasted.

So I spent a bit of time googling solutions. How had others modeled associations in their APIs? I found several potential solutions, including nesting endpoints and creating mirrored endpoints that reflected the opposite versions of the same association. However, I felt that the best solution (at least for me) was to expose the associations as resources themselves, and manipulate them with their own set of endpoints. I liked this because it would enable me to manipulate individual associations, and cleanly add or remove them without worrying about contamination from other areas. It seemed like the ideal solution for an app that encouraged users to add and remove recipes and editors at their leisure.

Of course, this meant making additional endpoints, schemas, etc.; the whole nine yards. But by this point I've got some experience with it, so it wasn't nearly as bad as I'd feared.

### The Schemas

First thing's first: while there are three many-to-many associations in my database (ingredient to line, recipe to grocerylist, user to grocerylist), I'm only exposing the latter two as resources in of themselves. That's because the ingredient-to-line association actually works *better* if they are created and destroyed as a single unit. After all, changing "whole milk" to "milk" as the ingredient of the line not only adds "milk", it also destroys "whole milk." So modifying each relationship individually would actually be counterproductive in that case.

But the other two are different stories. I started by creating schemas to represent the associations. This worked slightly differently than my previous schemas, since I was querying a Table object rather than a Model, and because the actual return of is extremely simple. I needed my schema to recognize three integer values: the `id` of the association, the `id` of the grocerylist, and the `id` of whatever other resource was being associated with it. For example, here's the schema for user-to-grocerylist associations:

{% highlight python %}
def check_if_tuple(data, first_id_name, second_id_name):
    if isinstance(data, tuple):
        id_, first_id, second_id = data
        return {"id": id_, first_id_name: first_id, second_id_name: second_id}
    return data

class EditorAssociationSchema(ma.Schema):
    id = fields.Int()
    grocerylist_id = fields.Int(required=True)
    user_id = fields.Int(requred=True)

    @pre_load
    def load_data(self, data, ** kwargs):
        print("in preload")
        print(data)
        return check_if_tuple(data, "grocerylist_id", "user_id")

    @post_load
    def get_associated_user_grocerylist(self, data, ** kwargs):
        return (
            GroceryList.query.get(data["grocerylist_id"]),
            User.query.get(data["user_id"])
        )

    @pre_dump
    def dump_data(self, data, ** kwargs):
        return check_if_tuple(data, "grocerylist_id", "user_id")
{% endhighlight %}

There are a couple of things to note here. The `check_if_tuple` function converts the tuple value that the database provides for the associations into a dictionary that the schema can understand and validate. It serves both as a `pre_dump` function (for taking the tuple and dumping it into the body of the response) and as a `pre_load` function (for loading the tuple to be manipulated). Additionally, the `post_load` function returns a tuple of its own; the GroceryList object and the User object that is going to have its editing privileges modified. I do this for convienence, as it makes the endpoints much easier to work with.

### The Endpoints

In order to keep the endpoints looking clean, I wrote a few helper functions that take care of most of the low-end logic and help the endpoints look more like a "table of contents." Unfortunately, because I'm dealing with a Table rather than a Model, I couldn't reuse my previous helper functions, but astute readers will notice definite similarities here.

{% highlight python %}
def load_list_and_check_permissions(association_to_modify, association_schema):
    list_to_modify, resource_to_change = association_schema.load(association_to_modify)
    if g.user not in list_to_modify.editors and g.user.id != list_to_modify.creator_id:
        raise InvalidUsage("You don't have permission to modify this list.", 401)

    return list_to_modify, resource_to_change


def get_association_or_404(id_, table):
    association = db.session.query(table).filter_by(id=id_).first()
    if not association:
        raise InvalidUsage("The association you're looking for can't be found.", 404)
    return association


def add_association(new_resource_for_list, list_to_add_to):
    if new_resource_for_list not in list_to_add_to:
        list_to_add_to.append(new_resource_for_list)
        db.session.commit()
{% endhighlight %}

The first function makes use of my new schemas to load the necessary resources, and checks that the user has permission to edit the list (either to add/remove a recipe or to add/remove an editor). If so, it returns the resources. If not, it returns a `401 Forbidden`.

The second function works the same way my `get_resource_or_404` function works: it finds the relevant association by its `id` and returns it. If no associated `id` exists, it returns a `404`.

The third function actually adds the association to the list, provided the association doesn't already exist. I want the associations to be idempotent (i.e., sending many of the same requests does not create additional associations), so the function doesn't do anything if the association already exists.

Here are the endpoints for my user/grocerylist associations.

{% highlight python %}
@associations.route("/list-user-associations", methods=["GET"])
def get_list_user_associations():
    return jsonify(list_user_associations_schema.dump(db.session.query(user_list_associations).all()))


@associations.route("/list-user-associations/<int:id_>", methods=["GET"])
def get_specific_list_user_association(id_):
    specific_association = get_association_or_404(id_, user_list_associations)
    return jsonify(list_user_association_schema.dump(specific_association))


@associations.route("/list-user-associations", methods=["PUT"])
@auth.login_required
def post_list_user_association():
    list_to_modify, new_editor = load_list_and_check_permissions(request.json, list_user_association_schema)
    add_association(new_editor, list_to_modify.editors)

    return jsonify(list_user_association_schema.dump(
        db.session.query(user_list_associations).filter_by(
            grocery_list=list_to_modify.id,
            user=new_editor.id
        ).first()
    )), 201


@associations.route("/list-user-associations/<int:id_>", methods=["DELETE"])
@auth.login_required
def delete_list_user_association(id_):
    association_to_remove = get_association_or_404(id_, user_list_associations)
    list_to_modify, editor_to_remove = load_list_and_check_permissions(association_to_remove, list_user_association_schema)
    list_to_modify.editors.remove(editor_to_remove)
    db.session.commit()
    return "", 204
{% endhighlight %}

They all make use of the helper functions defined above. There are a few places where I had to include some lower level logic here, most notably when returning the result of a "PUT" request. I did so because the queries don't generalize quite as easily, although I may come back and write something a bit more elegant.

But regardless, the end result is the same. With the exposure of these associations as endpoints in of themselves, individual associations can be added or deleted without worrying about messing up other parts of the data. This is a much stronger solution than what I previously had, and it closes one of the last real holes in my backend. I still need to do some error catching and tidy up a bit more, but this part of my app is almost done. 
