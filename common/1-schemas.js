Schemas = {};
UI.registerHelper("Schemas", Schemas);

Schemas.Host = new SimpleSchema({
	privateHost: {
		type: String
	},
	publicHost: {
		type: String
	},
	port: {
		type: Number,
		defaultValue: 2375
	},
	max: {
		type: Number,
		defaultValue: 200,
		label: "Max #"
	},
	active: {
		type: Boolean,
		defaultValue: true
	},
	status: {
		type: String,
		optional: true
	},
	tag: {
		type: String
	},
	shared: {
		type: Boolean,
		label: "Public Shared Host",
		defaultValue: false
	},
	metrics: {
		type: Object,
		optional: true
	},
	'metrics.running': {
		type: Number
	},
	'metrics.paused': {
		type: Number
	},
	details: {
		type: Object,
		blackbox: true,
		optional: true
	},
	dockerImages: {
		type: [Object],
		optional: true
	},
	'dockerImages.$.name': {
		type: String
	},
	'dockerImages.$.id': {
		type: String
	},
	'dockerImages.$.createdAt': {
		type: Date
	},
	'dockerImages.$.virtualSize': {
		type: Number
	}
});

Schemas.AppInstance = new SimpleSchema({
	port: {
		type: Number,
		label: "App port",
		optional: true
	},
	image: {
		type: String,
		label: "Docker image"
	},
	containerId: {
		type: String,
		label: "Container ID",
		optional: true
	},
	container: {
		type: Object,
		optional: true
	},
	'container.pid': {
		type: Number,
		optional: true
	},
	createdAt: {
		type: Date,
		denyUpdate: true,
		autoValue: function () {
		  if (this.isInsert)
		    return new Date;
		}
	},
	status: {
		type: String,
		optional: true
	},
	env: {
		type: Object,
		blackbox: true,
		label: "Defined environment variables"
	},
	actualEnv: {
		type: [String],
		optional: true,
		label: "Actual environment variables"
	},
	hostnames: {
		type: [String],
		optional: true
	},
	dockerHosts: {
		type: [String],
		label: "Hosts running this instance",
		optional: true
	}
});

Schemas.DockerImage = new SimpleSchema({
	name: {
		type: String,
		label: "Org/Name",
		index: 1,
		unique: true
	},
	tarUrl: {
		type: String,
		regEx: SimpleSchema.RegEx.Url,
		optional: true
	},
	shared: {
		type: Boolean,
		label: "Public Shared Image",
		defaultValue: false
	},
	inRepo: {
		type: Boolean,
		label: "Docker Hub Repo",
		defaultValue: true
	}
});

Schemas.LaunchInstance = new SimpleSchema({
	dockerImage: {
		type: String
	},
	hostname: {
		type: String,
		optional: true
	},
	env: {
		type: [Object],
		label: "Additional Environment Variables",
		optional: true
	},
	'env.$.name': {
		type: String
	},
	'env.$.value': {
		type: String
	}
});

Schemas.Settings = new SimpleSchema({
	activeHeal: {
		type: Boolean,
		defaultValue: false,
		label: "Active Heal (auto rebuild containers)"
	},
	redisUrl: {
		type: String,
		label: "Alternate Redis Host",
		optional: true
	},
	notifications: {
		type: Object,
		label: "System Notifications",
		optional: true
	},
	'notifications.instanceStatus': {
		type: Boolean
	},
	'notifications.hostStatus': {
		type: Boolean
	},
	'notifications.hostStatus': {
		type: Boolean
	},
	kadira: {
		type: Object,
		label: "Kadira",
		optional: true
	},
	'kadira.appId': {
		type: String
	},
	'kadira.appSecret': {
		type: String
	}
});