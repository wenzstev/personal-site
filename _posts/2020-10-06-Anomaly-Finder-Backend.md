---
layout: post
title: A New Project - Anomalies
author: Steve
---

This is an introduction to a new idea that I've been wanting to work on for some time. <!--more--> I've been interested in the idea of collaborative storytelling, building a shared world with numerous authors contributing their own parts. This is my attempt to create something in that vein, inspired by the [Anomaly](https://stellaris.paradoxwikis.com/Anomaly) feature in the game *Stellaris*. I have a lot of ideas for where this could go, but my most basic implementation is that of numerous small stories ("Anomalies") that users create and share with each other. You can read other Anomalies and vote on them, which in turn makes them rise up the "leaderboard." You can also write your own Anomalies and see how they're ranked by other people.

Because I'm mindful of the amount of time that everything takes, I want to try a somewhat different approach to development than I did before. Rather than try to complete all of the program's functions and features in one go and then publishing it, I'm going to try and develop a Minimum Viable Product, push it, and then iterate from there. With that in mind, I went full steam ahead with my Python backend.

### The Backend

I'm building this backend essentially the same was as my previous work with SousChef: it's a Flask backend serving an API. Following in the footsteps of my previous project enabled me to get it off the ground faster, and it only took a few hours for me to get the base code down.

Currently, the database has only one model: the `Anomaly`, which is pretty much just a title, some text, and a score.

{% highlight python %}
from src import db


class Anomaly(db.Model):
    __tablename__="anomaly"
    id_ = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    body = db.Column(db.String(), nullable=False)
    score = db.Column(db.Integer, default=0)

{% endhighlight %}

It's dead simple, and in time I would like to expand it to add users, types of anomaly, and ways to link them together. But for now, this will do just fine. I also set up a schema (using Marshmallow), but it's so dead simple that it's not really worth showing. I also adapted my code from the SousChef backend to create a number of helper methods for adding and retrieving resources.

{% highlight python %}
def get_resource_or_404(resource_type, identifier):
    resource = resource_type.query.get(identifier)
    if not resource:
        raise InvalidUsage("Resource not found", 404)
    return resource


def load_resource_from_schema(resource_type, new_resource_json):
    if not new_resource_json:
        raise InvalidUsage("Data formatted incorrectly.")

    try:
        new_resource = schemas_to_models[resource_type.__tablename__].load(new_resource_json)
        return new_resource
    except ValidationError as e:
        raise InvalidUsage("Data formatted incorrectly.", payload=e)


def post_new_resource(resource_type, new_resource_json):
    new_resource = load_resource_from_schema(resource_type, new_resource_json)

    try:
        db.session.add(new_resource)
        db.session.commit()
        return new_resource
    except IntegrityError as e:
        raise InvalidUsage("You're trying to load something that is already in the database.", payload="IntegrityError")

{% endhighlight %}

These aren't strictly necessary for just one resource, but I think they'll prove useful when I start adding a number of different resources to the database. Plus they keep the routes extremely clean:

{% highlight python %}
@routes.route("/api/anomalies", methods=["GET"])
def get_anomalies():
    anomalies = get_anomalies_by_params(request.args)
    return jsonify(anomalies_schema.dump(anomalies))


@routes.route("/api/anomalies", methods=["POST"])
def post_anomaly():
    new_anomaly = post_new_resource(Anomaly, request.json)
    return jsonify(anomaly_schema.dump(new_anomaly)), 201


@routes.route("/api/anomalies/<int:id_>", methods=["GET"])
def get_specific_anomaly(id_):
    current_anomaly = get_resource_or_404(Anomaly, id_)
    return jsonify(anomaly_schema.dump(current_anomaly))
{% endhighlight %}

In addition to the basic routes, I also created a `vote` route that allows a score to be added or subtracted from the anomaly. This is what the frontend will use to alter the score.

{% highlight python %}
@routes.route("/api/anomalies/<int:id_>/vote", methods=["PUT"])
def upvote_anomaly(id_):
    current_anomaly = get_resource_or_404(Anomaly, id_)
    current_anomaly.score += request.json.get("increment")
    db.session.commit()
    return jsonify(anomaly_schema.dump(current_anomaly))
{% endhighlight %}

Finally, I also added a function to return a random anomaly, if requested. This is part of the basic `GET` request, and is active if provided if the "Random" parameter is set to "true."

{% highlight python %}
def get_anomalies_by_params(params):
    if params.get("random"):
        anomalies = db.session.query(Anomaly).order_by(func.random())
        return [anomalies.first()]
    return db.session.query(Anomaly).all()
{% endhighlight %}

And that's about it! The backend is extremely simple right now, but that's the point. I want to have a working version of this up and running as soon as possible. If you want to check out the code (currently embedded in a React project), you can take a look [here](https://github.com/wenzstev/anomaly-finder).

Next up is the frontend--stay tuned!
