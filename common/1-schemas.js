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
  protocol: {
    type: String,
    allowedValues: ['http','https'],
    defaultValue: 'http'
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
		type: Number,
		label: "Shared",
		defaultValue: 0
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
		optional: true,
		index: 1
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
		optional: true,
		index: 1
	},
	env: {
		type: Object,
		blackbox: true,
		label: "User defined environment variables"
	},
	info: {
		type: Object,
		blackbox: true,
		label: "Docker Info",
		optional: true
	},
	hostnames: {
		type: [String],
		optional: true
	},
	dockerHosts: {
		type: [String],
		label: "Hosts running this instance",
		optional: true,
		index: 1
	},
	config: {
		type: Object,
		label: "Docker Options",
		blackbox: true,
		optional: true
	},
	userId: {
		type: String,
		optional: true,
		index: 1
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
	registryUrl: {
		type: String,
		regEx: SimpleSchema.RegEx.Url,
		optional: true
	},
	inRepo: {
		type: Boolean,
		label: "Docker Hub Repo",
		defaultValue: true
	},
	status: {
		type: String,
		defaultValue: "0",
		optional: true
	}
});

Schemas.AppTemplate = new SimpleSchema({
	image: {
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
	env: {
		type: [Object],
		label: "Additional Environment Variables",
		optional: true
	},
	'env.$.name': {
		type: String
	},
	'env.$.value': {
		type: String,
		optional: true
	}
});

Schemas.LaunchInstance = new SimpleSchema({
	dockerImage: {
		type: String
	},
	hostname: {
		type: String
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
	mailUrl: {
		type: String,
		label: "SMTP / Mail URL",
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
