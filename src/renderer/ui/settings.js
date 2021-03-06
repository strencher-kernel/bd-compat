import DiscordModules from "../modules/discord";
import SettingsManager from "../modules/settingsmanager";
import Utilities from "../modules/utilities";
import Components from "./components";
import ChannelCategory from "./icons/channelcategory";
import "./settings.scss";

export function SwitchItem({id, name, ...props}) {
    const SwitchForm = Components.get("SwitchItem");
    const value = SettingsManager.useState(() => SettingsManager.isEnabled(id));

    return (
        <SwitchForm
            {...props}
            value={value}
            onChange={() => {
                SettingsManager.setSetting(id, !value);
            }}
        >{name}</SwitchForm>
    );
}

export function renderItems(items) {
    return items.map((item, i) => {
        switch (item.type) {
            case "category": return React.createElement(Category, Object.assign({}, item, {key: "category-" + i}));
            case "switch": return React.createElement(SwitchItem, Object.assign({}, item, {key: item.id}));

            default: return null;
        }
    });
}

export function Category({name, requires, items}) {
    const [opened, setOpened] = React.useState(false);
    const [FormTitle, Caret] = Components.bulk("CategoryComponent", "FormTitle", "Caret");
    const isDisabled = SettingsManager.useState(() => !requires.every(id => SettingsManager.isEnabled(id)));
    const isOpened = React.useMemo(() => opened && !isDisabled, [isDisabled, opened]);

    return (
        <div className={Utilities.joinClassNames("bd-category", [isOpened, "bd-category-opened"], [isDisabled, "bd-category-disabled"])}>
            <div className="bd-category-header" onClick={() => setOpened(!opened)}>
                <FormTitle tag={FormTitle.Tags.H3}>{name}</FormTitle>
                <Caret className="bd-caret" direction={isOpened ? Caret.Directions.DOWN : Caret.Directions.LEFT} />
            </div>
            <div className="bd-category-body">
                {isOpened && renderItems(items)}
            </div>
        </div>
    );
}

export default function SettingsPanel() {
    const [FormTitle, Divider] = Components.bulk("SettingsPanel", "FormTitle", "FormDivider");
    const items = Object.entries(SettingsManager.items);

    return DiscordModules.React.createElement("div", {
        className: "bdc-settings-panel",
        children: [
            DiscordModules.React.createElement("div", {
                className: "bd-settings-title"
            }, "Settings"),
            items.map(([collection, {settings}], index) => {
                return [
                    <FormTitle tag="h5" style={{ marginTop: index === 0 ? 25 : 0, marginBottom: 15 }}>
                        {collection}
                    </FormTitle>,
                    ...renderItems(settings),
                    items.length - 1 !== index && <div style={{ marginBottom: 25 }} />
                ].filter(Boolean);
            })
        ]
    });
}