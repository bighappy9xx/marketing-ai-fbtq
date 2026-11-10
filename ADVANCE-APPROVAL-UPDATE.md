# Advance approval update

Approval order: department_manager (same branch and department as the invoice) -> accountant -> accountant disbursement.

The existing approvals.manager field is retained for compatibility. Existing decisions and audit history are preserved. Branch managers retain visibility but cannot approve the first stage. Self approval remains forbidden.

Merge these files with your current checkout before deployment. Deploy the web app and Firestore Rules/indexes together:

```sh
firebase deploy --only "hosting,firestore:rules,firestore:indexes" --project mediafbtq-6e1bb
```

Wait for the advanceInvoices branch/department index to finish building. Department managers need both branch and department set in their user profile.

If your deployment uses callable functions instead of the current direct Firestore workflow, also deploy the updated reviewWorkflow function:

```sh
firebase deploy --only "functions:reviewWorkflow" --project mediafbtq-6e1bb
```

Validation: five workflow logic tests passed, including branch manager rejection, wrong department/branch, self approval, two-stage approval, payment and immutable audit history. Firestore Rules were not compiled or deployed here. The older full browser workflow fixture times out during invoice creation because it expects the former callable flow.
