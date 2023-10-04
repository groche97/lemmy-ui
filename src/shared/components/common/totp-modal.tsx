import {
  Component,
  MouseEventHandler,
  RefObject,
  createRef,
  linkEvent,
} from "inferno";
import { I18NextService } from "../../services";
import { toast } from "../../toast";
import type { Modal } from "bootstrap";

interface TotpModalProps {
  /**Takes totp as param, returns whether submit was successful*/
  onSubmit: (totp: string) => Promise<boolean>;
  onClose: MouseEventHandler;
  type: "login" | "remove" | "generate";
  secretUrl?: string;
  show?: boolean;
}

interface TotpModalState {
  totp: string;
  qrCode?: string;
}

const TOTP_LENGTH = 6;

async function handleSubmit(modal: TotpModal, totp: string) {
  const successful = await modal.props.onSubmit(totp);

  if (!successful) {
    modal.setState({ totp: "" });
    modal.inputRefs[0]?.focus();
  }
}

function handleInput(
  { modal, i }: { modal: TotpModal; i: number },
  event: any,
) {
  if (isNaN(event.target.value)) {
    event.preventDefault();
    return;
  }

  modal.setState(prev => ({ ...prev, totp: prev.totp + event.target.value }));
  modal.inputRefs[i + 1]?.focus();

  const { totp } = modal.state;
  if (totp.length >= TOTP_LENGTH) {
    handleSubmit(modal, totp);
  }
}

function handleKeyUp(
  { modal, i }: { modal: TotpModal; i: number },
  event: any,
) {
  if (event.key === "Backspace" && i > 0) {
    event.preventDefault();

    modal.setState(prev => ({
      ...prev,
      totp: prev.totp.slice(0, prev.totp.length - 1),
    }));
    modal.inputRefs[i - 1]?.focus();
  }
}

function handlePaste(modal: TotpModal, event: any) {
  event.preventDefault();
  const text: string = event.clipboardData.getData("text");

  if (text.length > TOTP_LENGTH || isNaN(Number(text))) {
    toast("Invalid TOTP: Must be string of six digits", "danger");
    modal.setState({ totp: "" });
  } else {
    modal.setState({ totp: text });
    handleSubmit(modal, text);
  }
}

export default class TotpModal extends Component<
  TotpModalProps,
  TotpModalState
> {
  private readonly modalDivRef: RefObject<HTMLDivElement>;
  inputRefs: (HTMLInputElement | null)[] = [];
  modal: Modal;
  state: TotpModalState = {
    totp: "",
  };

  constructor(props: TotpModalProps, context: any) {
    super(props, context);

    this.modalDivRef = createRef();

    this.clearTotp = this.clearTotp.bind(this);
    this.handleShow = this.handleShow.bind(this);
  }

  async componentDidMount() {
    this.modalDivRef.current?.addEventListener(
      "shown.bs.modal",
      this.handleShow,
    );

    this.modalDivRef.current?.addEventListener(
      "hidden.bs.modal",
      this.clearTotp,
    );

    const Modal = (await import("bootstrap/js/dist/modal")).default;
    this.modal = new Modal(this.modalDivRef.current!);

    if (this.props.show) {
      this.modal.show();
    }
  }

  componentWillUnmount() {
    this.modalDivRef.current?.removeEventListener(
      "shown.bs.modal",
      this.handleShow,
    );

    this.modalDivRef.current?.removeEventListener(
      "hidden.bs.modal",
      this.clearTotp,
    );

    this.modal.dispose();
  }

  componentDidUpdate({ show: prevShow }: TotpModalProps) {
    if (!!prevShow !== !!this.props.show) {
      if (this.props.show) {
        this.modal.show();
      } else {
        this.modal.hide();
      }
    }
  }

  render() {
    const { type, secretUrl, onClose } = this.props;
    const { totp } = this.state;

    return (
      <div
        className="modal fade"
        id="totpModal"
        tabIndex={-1}
        aria-hidden
        aria-labelledby="#totpModalTitle"
        data-bs-backdrop="static"
        ref={this.modalDivRef}
      >
        <div className="modal-dialog modal-fullscreen-sm-down">
          <div className="modal-content">
            <header className="modal-header">
              <h3 className="modal-title" id="totpModalTitle">
                {type === "generate"
                  ? "Enable 2 Factor Authentication"
                  : type === "remove"
                  ? "Disable 2 Factor Authentication"
                  : "Enter 2FA Token"}
              </h3>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </header>
            <div className="modal-body d-flex flex-column  align-items-center justify-content-center">
              {type === "generate" && (
                <div>
                  <a
                    className="btn btn-secondary mx-auto d-block totp-link"
                    href={secretUrl}
                  >
                    Click here for your TOTP link
                  </a>
                  <div className="mx-auto mt-3 w-50 h-50 text-center">
                    <strong className="fw-semibold">
                      or scan this QR code in your authenticator app
                    </strong>
                    <img
                      src={this.state.qrCode}
                      className="d-block mt-1 mx-auto"
                      alt="TOTP QR code"
                    />
                  </div>
                </div>
              )}
              <form id="totp-form">
                <label
                  className="form-label ms-2 mt-4 fw-bold"
                  id="totp-input-label"
                  htmlFor="totp-input-0"
                >
                  Enter TOTP
                </label>
                <div className="d-flex justify-content-between align-items-center p-2">
                  {Array.from(Array(TOTP_LENGTH).keys()).map(i => (
                    <input
                      key={
                        i /*While using indices as keys is usually bad practice, in this case we don't have to worry about the order of the list items changing.*/
                      }
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={totp[i] ?? ""}
                      disabled={totp.length !== i}
                      aria-labelledby="totp-input-label"
                      id={`totp-input-${i}`}
                      className="form-control form-control-lg mx-2 p-1 p-md-2 text-center"
                      onInput={linkEvent({ modal: this, i }, handleInput)}
                      onKeyUp={linkEvent({ modal: this, i }, handleKeyUp)}
                      onPaste={linkEvent(this, handlePaste)}
                      ref={element => {
                        this.inputRefs[i] = element;
                      }}
                    />
                  ))}
                </div>
              </form>
            </div>
            <footer className="modal-footer">
              <button
                type="button"
                className="btn btn-danger"
                onClick={onClose}
              >
                {I18NextService.i18n.t("cancel")}
              </button>
            </footer>
          </div>
        </div>
      </div>
    );
  }

  clearTotp() {
    this.setState({ totp: "" });
  }

  async handleShow() {
    this.inputRefs[0]?.focus();

    if (this.props.type === "generate") {
      const { getSVG } = await import("@shortcm/qr-image/lib/svg");

      this.setState({
        qrCode: URL.createObjectURL(
          new Blob([(await getSVG(this.props.secretUrl!)).buffer], {
            type: "image/svg+xml",
          }),
        ),
      });
    }
  }
}