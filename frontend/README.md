# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## reCAPTCHA v3 site key

The registration page uses `react-google-recaptcha-v3`. The provider reads the key at build time from `process.env.REACT_APP_RECAPTCHA_KEY`.

- Source: Create React App only injects env vars prefixed with `REACT_APP_` during the frontend build. This key must be set in the environment where the frontend is built.
- It does not come from Render (backend). If the key is missing, the frontend build did not receive it.

### Netlify (production)
- Site settings → Build & deploy → Environment → Environment variables.
- Add `REACT_APP_RECAPTCHA_KEY` with your Google reCAPTCHA v3 site key.
- Redeploy the site so the variable is embedded in the build.
- In Google reCAPTCHA admin, ensure allowed domains include `wastedwave.netlify.app`.

### Local development
- Create `frontend/.env` with:
	```
	REACT_APP_RECAPTCHA_KEY=your_site_key_here
	```
- Restart the dev server so CRA picks it up.

### Backend verification
- The backend (Render) verifies the `captchaToken` server-side using the secret key. This is separate from the site key and is never exposed to the frontend.
- Ensure backend CORS allows the frontend origin.

### Troubleshooting
- If you see `[reCAPTCHA] REACT_APP_RECAPTCHA_KEY is missing` in the console on `/registro`, the build didn't have the env var. Check Netlify env vars and redeploy.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
