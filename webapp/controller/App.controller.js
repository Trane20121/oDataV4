sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Sorter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
  ],
  function (
    Controller,
    JSONModel,
    MessageBox,
    MessageToast,
    Sorter,
    Filter,
    FilterOperator,
    FilterType
  ) {
    "use strict";

    return Controller.extend("sap.ui.core.tutorial.odatav4.controller.App", {
      onInit: function () {
        var oMessageManager = sap.ui.getCore().getMessageManager(),
          oMessageModel = oMessageManager.getMessageModel(),
          oMessageModelBinding = oMessageModel.bindList(
            "/",
            undefined,
            [],
            new Filter("technical", FilterOperator.EQ, true)
          ),
          oViewModel = new JSONModel({
            busy: false,
            hasUIChanges: false,
            usernameEmpty: false,
            order: 0,
          });
        this.getView().setModel(oViewModel, "appView");
        this.getView().setModel(oMessageModel, "message");

        oMessageModelBinding.attachChange(this.onMessageBindingChange, this);
        this._bTechnicalErrors = false;
      },

      onCreate: function () {
        var oList = this.byId("peopleList"),
          oBinding = oList.getBinding("items"),
          oContext = oBinding.create({
            UserName: "",
            FirstName: "",
            LastName: "",
            Age: "",
          });

        this._setUIChanges();
        this.getView().getModel("appView").setProperty("/usernameEmpty", true);

        oList.getItems().some(function (oItem) {
          if (oItem.getBindingContext() === oContext) {
            oItem.focus();
            oItem.setSelected(true);
            return true;
          }
        });
      },

      onDelete: function () {
        var oContext,
          oPeopleList = this.byId("peopleList"),
          oSelected = oPeopleList.getSelectedItem(),
          sUserName;

        if (oSelected) {
          oContext = oSelected.getBindingContext();
          sUserName = oContext.getProperty("UserName");
          oContext.delete().then(
            function () {
              MessageToast.show(
                this._getText("deletionSuccessMessage", sUserName)
              );
            }.bind(this),
            function (oError) {
              if (
                oContext === oPeopleList.getSelectedItem().getBindingContext()
              ) {
                this._setDetailArea(oContext);
              }
              this._setUIChanges();
              if (oError.canceled) {
                MessageToast.show(
                  this._getText("deletionRestoredMessage", sUserName)
                );
                return;
              }
              MessageBox.error(oError.message + ": " + sUserName);
            }.bind(this)
          );
          this._setDetailArea();
          this._setUIChanges(true);
        }
      },

      onSave: function () {
        var fnSuccess = function () {
          this._setBusy(false);
          MessageToast.show(this._getText("changesSentMessage"));
          this._setUIChanges(false);
        }.bind(this);

        var fnError = function (oError) {
          this._setBusy(false);
          this._setUIChanges(false);
          MessageBox.error(oError.message);
        }.bind(this);

        this._setBusy(true); // Lock UI until submitBatch is resolved.
        this.getView()
          .getModel()
          .submitBatch("peopleGroup")
          .then(fnSuccess, fnError);
        this._bTechnicalErrors = false; // If there were technical errors, a new save resets them.
      },

      _setBusy: function (bIsBusy) {
        var oModel = this.getView().getModel("appView");
        oModel.setProperty("/busy", bIsBusy);
      },

      onMessageBindingChange: function (oEvent) {
        var aContexts = oEvent.getSource().getContexts(),
          aMessages,
          bMessageOpen = false;

        if (bMessageOpen || !aContexts.length) {
          return;
        }

        // Extract and remove the technical messages
        aMessages = aContexts.map(function (oContext) {
          return oContext.getObject();
        });
        sap.ui.getCore().getMessageManager().removeMessages(aMessages);

        this._setUIChanges(true);
        this._bTechnicalErrors = true;
        MessageBox.error(aMessages[0].message, {
          id: "serviceErrorMessageBox",
          onClose: function () {
            bMessageOpen = false;
          },
        });

        bMessageOpen = true;
      },

      onSelectionChange: function (oEvent) {
        this._setDetailArea(
          oEvent.getParameter("listItem").getBindingContext()
        );
      },

      _setDetailArea: function (oUserContext) {
        var oDetailArea = this.byId("detailArea"),
          oLayout = this.byId("defaultLayout"),
          oOldContext,
          oSearchField = this.byId("searchField");

        if (!oDetailArea) {
          return;
        }
        
        oOldContext = oDetailArea.getBindingContext();
        if (oOldContext) {
          oOldContext.setKeepAlive(false);
        }
        if (oUserContext) {
          oUserContext.setKeepAlive(true),
            this._setDetailArea.bind(this);
        }

        oDetailArea.setBindingContext(oUserContext || null);
        // resize view
        oDetailArea.setVisible(!!oUserContext);
        oLayout.setSize(oUserContext ? "60%" : "100%");
        oLayout.setResizable(!!oUserContext);
        oSearchField.setWidth(oUserContext ? "40%" : "20%");
      },

      onResetChanges: function () {
        this.byId("peopleList").getBinding("items").resetChanges();
        this._bTechnicalErrors = false;
        this._setUIChanges();
      },

      onInputChange: function (oEvt) {
        if (oEvt.getParameter("escPressed")) {
          this._setUIChanges();
        } else {
          this._setUIChanges(true);
          if (
            oEvt
              .getSource()
              .getParent()
              .getBindingContext()
              .getProperty("UserName")
          ) {
            this.getView()
              .getModel("appView")
              .setProperty("/usernameEmpty", false);
          }
        }
      },

      onSearch: function () {
        var oView = this.getView(),
          sValue = oView.byId("searchField").getValue(),
          oFilter = new Filter("LastName", FilterOperator.Contains, sValue);

        oView
          .byId("peopleList")
          .getBinding("items")
          .filter(oFilter, FilterType.Application);
      },

      onSort: function () {
        var oView = this.getView(),
          aStates = [undefined, "asc", "desc"],
          aStateTextIds = ["sortNone", "sortAscending", "sortDescending"],
          sMessage,
          iOrder = oView.getModel("appView").getProperty("/order");

        iOrder = (iOrder + 1) % aStates.length;
        var sOrder = aStates[iOrder];

        oView.getModel("appView").setProperty("/order", iOrder);
        oView
          .byId("peopleList")
          .getBinding("items")
          .sort(sOrder && new Sorter("LastName", sOrder === "desc"));

        sMessage = this._getText("sortMessage", [
          this._getText(aStateTextIds[iOrder]),
        ]);
        MessageToast.show(sMessage);
      },

      onRefresh: function () {
        var oBinding = this.byId("peopleList").getBinding("items");

        if (oBinding.hasPendingChange()) {
          MessageBox.error(this._getText("refreshNotPossibleMessage"));
          return;
        }
        oBinding.refresh();
        MessageToast.show(this._getText("refreshSuccessMessage"));
      },

      _getText: function (sTextId, aArgs) {
        return this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle()
          .getText(sTextId, aArgs);
      },

      _setUIChanges: function (bHasUIChanges) {
        if (this._bTechnicalErrors) {
          // If there is currently a technical error, then force 'true'.
          bHasUIChanges = true;
        } else if (bHasUIChanges === undefined) {
          bHasUIChanges = this.getView().getModel().hasPendingChanges();
        }
        var oModel = this.getView().getModel("appView");
        oModel.setProperty("/hasUIChanges", bHasUIChanges);
      },

      onResetDataSource: function () {
        var oModel = this.getView().getModel(),
          oOperation = oModel.bindContext("/ResetDataSource(...)");

        oOperation.invoke().then(
          function () {
            oModel.refresh();
            MessageToast.show(this._getText("sourceResetSuccessMessage"));
          }.bind(this),
          function (oError) {
            MessageBox.error(oError.message);
          }
        );
      },
    });
  }
);
