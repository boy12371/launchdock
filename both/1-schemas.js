Schemas = {};

Schemas.Host = new SimpleSchema({
	privateHost: {
		type: String
	},
	publicHost: {
		type: String
	},
	port: {
		type: Number,
		defaultValue: 4243
	},
	max: {
		type: Number,
		defaultValue: 100,
		label: "Max #"
	},
	active: {
		type: Boolean,
		defaultValue: true
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
	host: {
		type: String
	},
	port: {
		type: Number
	},
	image: {
		type: String
	},
	containerId: {
		type: String
	},
	createdAt: {
		type: Date,
		denyUpdate: true
	},
	status: {
		type: String
	},
	env: {
		type: Object,
		blackbox: true
	},
	docker: {
		type: Object,
		blackbox: true
	},
	hostnames: {
		type: [String],
		optional: true
	},
	dockerHosts: {
		type: [String],
		optional: true
	}
});

Schemas.DockerImage = new SimpleSchema({
	name: {
		type: String,
		index: 1,
		unique: true
	},
	tarUrl: {
		type: String,
		regEx: SimpleSchema.RegEx.Url,
		optional: true
	},
	inRepo: {
		type: Boolean,
		defaultValue: true
	}
});