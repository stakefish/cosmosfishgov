# Cosmos Governance Monitoring and Alerting

This project monitors and displays all governance proposals and their results in real time with friendly UI. It also allows anyone to sign up to receive alerts on any new proposal that are entering either their deposit period and/or active voting period. For any questions related to this project, please contact us at: cosmos at bit dot fish  

![Cosmos.fish](https://i.imgur.com/cTyMhyC.png)

## Setup Instruction

### 1. Create a file named `.env` in the `cosmosfish` directory
`.env` should have the following config:
```
MONGODB_URI=mongodb://<mlab_user>:<mlab_password>@<mlab_connection_url>
MONGODB_URI_LOCAL=mongodb://localhost:27017

# Put in a lot of random characters here.
SESSION_SECRET=REPLACE_THIS_WITH_A_RANDOM_STRING

# Replace the following with email service information. See https://nodemailer.com/smtp/well-known/ for more information
MAIL_SERVICE_SERVICE=...
MAIL_SERVICE_USER=...
MAIL_SERVICE_PASSWORD=...

# This is needed for email unsubscribe links to work. Replace with where you are deploying this
DEPLOYED_URL=https://cosmos.fish

# This must point to a fully sycned working Cosmos node, for example: 100.100.100.100:26657
GAIA_FULL_NODE_IP=REPLACE_WITH_IP
```

### 2. Install `mongodb`
```
brew install mongodb
sudo mkdir -p /data/db
sudo chmod 777 /data/db
```

### 3. Install `cosmos-sdk`
You can follow the official installation instruction here: https://github.com/cosmos/cosmos-sdk or use the following:

First please install `Go`. https://golang.org/dl/

Then please make sure your `$GOPATH` has been set properly per https://github.com/golang/go/wiki/SettingGOPATH

Run the following:
```
mkdir -p $GOPATH/src/github.com/cosmos
cd $GOPATH/src/github.com/cosmos/
rm -rf cosmos-sdk
git clone https://github.com/cosmos/cosmos-sdk
cd cosmos-sdk
git fetch --tags
git checkout v0.24.2
make get_tools && make get_vendor_deps && make install
```

If you are running into errors with `make install` Try using this command instead:
```
env CGO_ENABLED=0 make install
```


### 4. Run it!
Start with:
```
mongod
```

In a separate shell, run this:
```
npm install && npm run-script build && npm start
```
### 5. Try it!
Your initial console output should look like this

<img src="https://i.imgur.com/zlOCwrR.png" width="400">

Once it finishes syncing it should look like this

<img src="https://i.imgur.com/373QFf1.png" width="400">


You can then access the site by going to `http://localhost:3000` and see the following
![Cosmos.fish](https://i.imgur.com/cTyMhyC.png)

# Have fun!
